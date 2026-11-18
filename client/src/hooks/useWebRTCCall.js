import { useCallback, useEffect, useRef, useState } from 'react';
import { decryptMessagePayload, encryptMessagePayload } from '../crypto/e2ee';

function buildIceServers() {
  const servers = [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
  ];

  const turnUrl = import.meta.env.VITE_TURN_URL;
  if (turnUrl) {
    const turnConfig = { urls: turnUrl.split(',').map((u) => u.trim()).filter(Boolean) };
    if (import.meta.env.VITE_TURN_USERNAME) {
      turnConfig.username = import.meta.env.VITE_TURN_USERNAME;
    }
    if (import.meta.env.VITE_TURN_CREDENTIAL) {
      turnConfig.credential = import.meta.env.VITE_TURN_CREDENTIAL;
    }
    servers.push(turnConfig);
  }

  return servers;
}

function playSoftRingPulse() {
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const now = ctx.currentTime;

    [523.25, 659.25].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + i * 0.16);

      gain.gain.setValueAtTime(0.0001, now + i * 0.16);
      gain.gain.exponentialRampToValueAtTime(0.045, now + i * 0.16 + 0.04);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + i * 0.16 + 0.35);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + i * 0.16);
      osc.stop(now + i * 0.16 + 0.38);
    });

    setTimeout(() => {
      ctx.close().catch(() => {});
    }, 900);
  } catch {
    // Browser autoplay policy may block sound before user interaction
  }
}

function describeMediaError(err, isVideo) {
  if (!window.isSecureContext) {
    return 'Voice and video calls require HTTPS (or localhost).';
  }
  if (!navigator.mediaDevices?.getUserMedia) {
    return 'Your browser does not support voice or video calling.';
  }
  const name = err?.name || '';
  if (name === 'NotAllowedError' || name === 'PermissionDeniedError') {
    return isVideo
      ? 'Camera or microphone permission was denied. Please allow access and try again.'
      : 'Microphone permission was denied. Please allow access and try again.';
  }
  if (name === 'NotFoundError' || name === 'DevicesNotFoundError') {
    return isVideo
      ? 'No camera or microphone found on this device.'
      : 'No microphone found on this device.';
  }
  if (name === 'NotReadableError') {
    return 'Your camera or microphone is already in use by another app.';
  }
  return 'Could not access your microphone or camera.';
}

export function useWebRTCCall({ socket, aesKey, alias, participantCount }) {
  const [callStatus, setCallStatus] = useState('idle'); // idle | calling | incoming | connecting | connected
  const [callType, setCallType] = useState('audio'); // audio | video
  const [remoteAlias, setRemoteAlias] = useState('Anonymous');
  const [localStream, setLocalStream] = useState(null);
  const [remoteStream, setRemoteStream] = useState(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isCameraOff, setIsCameraOff] = useState(false);
  const [remoteMuted, setRemoteMuted] = useState(false);
  const [remoteCameraOff, setRemoteCameraOff] = useState(false);
  const [facingMode, setFacingMode] = useState('user');
  const [minimised, setMinimised] = useState(false);
  const [durationSec, setDurationSec] = useState(0);
  const [notice, setNotice] = useState('');

  const pcRef = useRef(null);
  const localStreamRef = useRef(null);
  const remoteStreamRef = useRef(null);
  const statusRef = useRef('idle');
  const callIdRef = useRef(null);
  const callTypeRef = useRef('audio');
  const remoteSessionIdRef = useRef(null);
  const pendingIceRef = useRef([]);
  const ringTimeoutRef = useRef(null);
  const ringIntervalRef = useRef(null);
  const noticeTimeoutRef = useRef(null);

  statusRef.current = callStatus;
  callTypeRef.current = callType;

  const showNotice = useCallback((msg) => {
    setNotice(msg);
    clearTimeout(noticeTimeoutRef.current);
    noticeTimeoutRef.current = setTimeout(() => {
      setNotice('');
    }, 4000);
  }, []);

  const stopRingChime = useCallback(() => {
    clearInterval(ringIntervalRef.current);
    ringIntervalRef.current = null;
  }, []);

  const sendSignal = useCallback(
    async (payload, targetSessionId = null) => {
      if (!socket || !aesKey) return;
      try {
        const { iv, ciphertext } = await encryptMessagePayload(aesKey, payload);
        socket.emit('call:signal', { iv, ciphertext, targetSessionId });
      } catch (err) {
        console.error('[CALL] Signal encrypt/send failed:', err);
      }
    },
    [socket, aesKey]
  );

  const cleanupCall = useCallback(
    (optionalNotice = '') => {
      clearTimeout(ringTimeoutRef.current);
      stopRingChime();

      if (pcRef.current) {
        try {
          pcRef.current.onicecandidate = null;
          pcRef.current.ontrack = null;
          pcRef.current.onconnectionstatechange = null;
          pcRef.current.oniceconnectionstatechange = null;
          pcRef.current.close();
        } catch {}
        pcRef.current = null;
      }

      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach((track) => {
          try {
            track.stop();
          } catch {}
        });
        localStreamRef.current = null;
      }

      remoteStreamRef.current = null;
      pendingIceRef.current = [];
      callIdRef.current = null;
      remoteSessionIdRef.current = null;

      setLocalStream(null);
      setRemoteStream(null);
      setCallStatus('idle');
      setIsMuted(false);
      setIsCameraOff(false);
      setRemoteMuted(false);
      setRemoteCameraOff(false);
      setMinimised(false);
      setDurationSec(0);
      setFacingMode('user');

      if (optionalNotice) showNotice(optionalNotice);
    },
    [showNotice, stopRingChime]
  );

  // Live call duration timer
  useEffect(() => {
    if (callStatus !== 'connected') {
      setDurationSec(0);
      return;
    }
    const start = Date.now();
    const id = setInterval(() => {
      setDurationSec(Math.floor((Date.now() - start) / 1000));
    }, 1000);
    return () => clearInterval(id);
  }, [callStatus]);

  // Incoming ringtone chime pulse
  useEffect(() => {
    if (callStatus !== 'incoming') {
      stopRingChime();
      return;
    }
    playSoftRingPulse();
    ringIntervalRef.current = setInterval(playSoftRingPulse, 2600);
    return stopRingChime;
  }, [callStatus, stopRingChime]);

  const flushPendingIce = useCallback(async (pc) => {
    if (!pc || !pc.remoteDescription) return;
    const queue = pendingIceRef.current.splice(0);
    for (const candidate of queue) {
      try {
        await pc.addIceCandidate(new RTCIceCandidate(candidate));
      } catch (err) {
        console.warn('[CALL] Failed to add queued ICE candidate:', err);
      }
    }
  }, []);

  const createPeerConnection = useCallback(
    (targetSessionId, activeCallId, stream) => {
      const pc = new RTCPeerConnection({
        iceServers: buildIceServers(),
      });

      const remote = new MediaStream();
      remoteStreamRef.current = remote;
      setRemoteStream(remote);

      if (stream) {
        stream.getTracks().forEach((track) => {
          pc.addTrack(track, stream);
        });
      }

      pc.ontrack = (event) => {
        if (event.streams && event.streams[0]) {
          event.streams[0].getTracks().forEach((track) => {
            if (!remote.getTracks().some((t) => t.id === track.id)) {
              remote.addTrack(track);
            }
          });
        } else if (event.track) {
          if (!remote.getTracks().some((t) => t.id === event.track.id)) {
            remote.addTrack(event.track);
          }
        }
        // Trigger React state refresh with a fresh MediaStream wrapper reference
        setRemoteStream(new MediaStream(remote.getTracks()));
      };

      pc.onicecandidate = (event) => {
        if (event.candidate) {
          sendSignal(
            {
              kind: 'ice',
              callId: activeCallId,
              candidate: event.candidate.toJSON ? event.candidate.toJSON() : event.candidate,
            },
            targetSessionId
          );
        }
      };

      const handleStateChange = () => {
        const state = pc.connectionState || pc.iceConnectionState;
        if (state === 'connected' || state === 'completed') {
          setCallStatus('connected');
        } else if (state === 'failed') {
          cleanupCall('Call connection lost. Please check your network and try again.');
        } else if (state === 'disconnected') {
          // Wait briefly in case of momentary mobile network switch
          setTimeout(() => {
            if (
              pcRef.current === pc &&
              (pc.connectionState === 'disconnected' || pc.connectionState === 'failed')
            ) {
              cleanupCall('Call disconnected.');
            }
          }, 5000);
        }
      };

      pc.onconnectionstatechange = handleStateChange;
      pc.oniceconnectionstatechange = handleStateChange;

      pcRef.current = pc;
      return pc;
    },
    [cleanupCall, sendSignal]
  );

  const acquireMedia = useCallback(async (type, preferredFacing = 'user') => {
    if (!navigator.mediaDevices?.getUserMedia) {
      throw new Error('UNSUPPORTED');
    }
    const constraints = {
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
      video:
        type === 'video'
          ? {
              facingMode: preferredFacing,
              width: { ideal: 1280 },
              height: { ideal: 720 },
            }
          : false,
    };
    return navigator.mediaDevices.getUserMedia(constraints);
  }, []);

  // Outgoing call
  const startCall = useCallback(
    async (type = 'audio') => {
      if (statusRef.current !== 'idle') return;
      if (participantCount < 2) {
        showNotice('Wait for the other person to join before calling.');
        return;
      }

      try {
        const stream = await acquireMedia(type, 'user');
        const newCallId = crypto.randomUUID
          ? crypto.randomUUID()
          : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

        localStreamRef.current = stream;
        callIdRef.current = newCallId;
        setLocalStream(stream);
        setCallType(type);
        setRemoteAlias('Other person');
        setCallStatus('calling');
        setIsMuted(false);
        setIsCameraOff(type !== 'video');
        setRemoteCameraOff(type !== 'video');
        setFacingMode('user');
        setMinimised(false);

        await sendSignal({
          kind: 'invite',
          callId: newCallId,
          callType: type,
          alias,
        });

        clearTimeout(ringTimeoutRef.current);
        ringTimeoutRef.current = setTimeout(() => {
          if (statusRef.current === 'calling' && callIdRef.current === newCallId) {
            sendSignal({ kind: 'hangup', callId: newCallId });
            cleanupCall('No answer.');
          }
        }, 45_000);
      } catch (err) {
        cleanupCall(describeMediaError(err, type === 'video'));
      }
    },
    [acquireMedia, alias, cleanupCall, participantCount, sendSignal, showNotice]
  );

  // Accept incoming call
  const acceptCall = useCallback(async () => {
    if (statusRef.current !== 'incoming') return;
    const activeCallId = callIdRef.current;
    const peerSessionId = remoteSessionIdRef.current;
    const activeType = callTypeRef.current;

    stopRingChime();

    try {
      const stream = await acquireMedia(activeType, 'user');
      localStreamRef.current = stream;
      setLocalStream(stream);
      setIsMuted(false);
      setIsCameraOff(activeType !== 'video');
      setFacingMode('user');
      setCallStatus('connecting');

      createPeerConnection(peerSessionId, activeCallId, stream);

      await sendSignal(
        {
          kind: 'accept',
          callId: activeCallId,
          alias,
        },
        peerSessionId
      );
    } catch (err) {
      await sendSignal({ kind: 'decline', callId: activeCallId }, peerSessionId);
      cleanupCall(describeMediaError(err, activeType === 'video'));
    }
  }, [acquireMedia, alias, cleanupCall, createPeerConnection, sendSignal, stopRingChime]);

  // Decline incoming call
  const declineCall = useCallback(() => {
    if (statusRef.current !== 'incoming') return;
    const activeCallId = callIdRef.current;
    const peerSessionId = remoteSessionIdRef.current;
    sendSignal({ kind: 'decline', callId: activeCallId }, peerSessionId);
    cleanupCall();
  }, [cleanupCall, sendSignal]);

  // End active / outgoing call
  const endCall = useCallback(() => {
    const activeCallId = callIdRef.current;
    const peerSessionId = remoteSessionIdRef.current;
    if (activeCallId) {
      sendSignal({ kind: 'hangup', callId: activeCallId }, peerSessionId);
    }
    cleanupCall('Call ended.');
  }, [cleanupCall, sendSignal]);

  // Toggle microphone
  const toggleMute = useCallback(() => {
    const stream = localStreamRef.current;
    if (!stream) return;
    const nextMuted = !isMuted;
    stream.getAudioTracks().forEach((track) => {
      track.enabled = !nextMuted;
    });
    setIsMuted(nextMuted);
    if (callIdRef.current && remoteSessionIdRef.current) {
      sendSignal(
        {
          kind: 'media-state',
          callId: callIdRef.current,
          audioEnabled: !nextMuted,
          videoEnabled: !isCameraOff,
        },
        remoteSessionIdRef.current
      );
    }
  }, [isCameraOff, isMuted, sendSignal]);

  // Toggle camera
  const toggleCamera = useCallback(() => {
    const stream = localStreamRef.current;
    if (!stream || callTypeRef.current !== 'video') return;
    const nextOff = !isCameraOff;
    stream.getVideoTracks().forEach((track) => {
      track.enabled = !nextOff;
    });
    setIsCameraOff(nextOff);
    if (callIdRef.current && remoteSessionIdRef.current) {
      sendSignal(
        {
          kind: 'media-state',
          callId: callIdRef.current,
          audioEnabled: !isMuted,
          videoEnabled: !nextOff,
        },
        remoteSessionIdRef.current
      );
    }
  }, [isCameraOff, isMuted, sendSignal]);

  // Switch front/back camera (mobile & tablets)
  const switchCamera = useCallback(async () => {
    const stream = localStreamRef.current;
    const pc = pcRef.current;
    if (!stream || callTypeRef.current !== 'video') return;

    const nextFacing = facingMode === 'user' ? 'environment' : 'user';
    try {
      const tempStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: nextFacing } },
        audio: false,
      });
      const newVideoTrack = tempStream.getVideoTracks()[0];
      if (!newVideoTrack) return;

      newVideoTrack.enabled = !isCameraOff;

      const oldVideoTrack = stream.getVideoTracks()[0];
      if (oldVideoTrack) {
        oldVideoTrack.stop();
        stream.removeTrack(oldVideoTrack);
      }
      stream.addTrack(newVideoTrack);

      if (pc) {
        const sender = pc.getSenders().find((s) => s.track?.kind === 'video');
        if (sender) {
          await sender.replaceTrack(newVideoTrack);
        }
      }

      setFacingMode(nextFacing);
      setLocalStream(new MediaStream(stream.getTracks()));
    } catch {
      showNotice('Could not switch camera on this device.');
    }
  }, [facingMode, isCameraOff, showNotice]);

  // Listen to encrypted WebRTC signalling events on socket
  useEffect(() => {
    if (!socket || !aesKey) return;

    const onCallSignal = async ({ fromSessionId, iv, ciphertext }) => {
      let data;
      try {
        data = await decryptMessagePayload(aesKey, iv, ciphertext);
      } catch {
        return;
      }

      if (!data?.kind) return;

      if (data.kind === 'invite') {
        if (statusRef.current !== 'idle') {
          sendSignal({ kind: 'busy', callId: data.callId }, fromSessionId);
          return;
        }
        callIdRef.current = data.callId;
        remoteSessionIdRef.current = fromSessionId;
        setCallType(data.callType === 'video' ? 'video' : 'audio');
        setRemoteAlias(data.alias || 'Anonymous');
        setRemoteCameraOff(data.callType !== 'video');
        setCallStatus('incoming');
        setMinimised(false);
        return;
      }

      // Ignore signals belonging to an old/different call
      if (data.callId && callIdRef.current && data.callId !== callIdRef.current) {
        return;
      }

      if (data.kind === 'accept' && statusRef.current === 'calling') {
        clearTimeout(ringTimeoutRef.current);
        remoteSessionIdRef.current = fromSessionId;
        if (data.alias) setRemoteAlias(data.alias);
        setCallStatus('connecting');

        try {
          const pc = createPeerConnection(fromSessionId, data.callId, localStreamRef.current);
          const offer = await pc.createOffer();
          await pc.setLocalDescription(offer);
          await sendSignal(
            {
              kind: 'offer',
              callId: data.callId,
              sdp: pc.localDescription.toJSON
                ? pc.localDescription.toJSON()
                : pc.localDescription,
            },
            fromSessionId
          );
        } catch (err) {
          console.error('[CALL] Offer failed:', err);
          cleanupCall('Could not start call connection.');
        }
        return;
      }

      if (data.kind === 'offer' && statusRef.current === 'connecting') {
        const pc = pcRef.current;
        if (!pc) return;
        try {
          await pc.setRemoteDescription(new RTCSessionDescription(data.sdp));
          await flushPendingIce(pc);
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          await sendSignal(
            {
              kind: 'answer',
              callId: data.callId,
              sdp: pc.localDescription.toJSON
                ? pc.localDescription.toJSON()
                : pc.localDescription,
            },
            fromSessionId
          );
        } catch (err) {
          console.error('[CALL] Answer failed:', err);
          cleanupCall('Could not connect the call.');
        }
        return;
      }

      if (data.kind === 'answer' && statusRef.current === 'connecting') {
        const pc = pcRef.current;
        if (!pc) return;
        try {
          await pc.setRemoteDescription(new RTCSessionDescription(data.sdp));
          await flushPendingIce(pc);
        } catch (err) {
          console.error('[CALL] Set remote answer failed:', err);
        }
        return;
      }

      if (data.kind === 'ice') {
        const pc = pcRef.current;
        if (!pc || !pc.remoteDescription) {
          pendingIceRef.current.push(data.candidate);
        } else {
          try {
            await pc.addIceCandidate(new RTCIceCandidate(data.candidate));
          } catch (err) {
            console.warn('[CALL] ICE add failed:', err);
          }
        }
        return;
      }

      if (data.kind === 'media-state') {
        if (typeof data.audioEnabled === 'boolean') setRemoteMuted(!data.audioEnabled);
        if (typeof data.videoEnabled === 'boolean') setRemoteCameraOff(!data.videoEnabled);
        return;
      }

      if (data.kind === 'decline') {
        cleanupCall('Call was declined.');
        return;
      }

      if (data.kind === 'busy') {
        cleanupCall('The other person is already on a call.');
        return;
      }

      if (data.kind === 'hangup') {
        cleanupCall('Call ended.');
      }
    };

    const onPeerDisconnected = ({ sessionId: leftSessionId }) => {
      if (
        statusRef.current !== 'idle' &&
        remoteSessionIdRef.current &&
        leftSessionId === remoteSessionIdRef.current
      ) {
        cleanupCall('The other person left the chat.');
      }
    };

    socket.on('call:signal', onCallSignal);
    socket.on('call:peer-disconnected', onPeerDisconnected);

    return () => {
      socket.off('call:signal', onCallSignal);
      socket.off('call:peer-disconnected', onPeerDisconnected);
    };
  }, [aesKey, cleanupCall, createPeerConnection, flushPendingIce, sendSignal, socket]);

  // Clean up tracks & RTCPeerConnection on unmount
  useEffect(() => {
    return () => {
      clearTimeout(noticeTimeoutRef.current);
      cleanupCall();
    };
  }, [cleanupCall]);

  return {
    callStatus,
    callType,
    remoteAlias,
    localStream,
    remoteStream,
    isMuted,
    isCameraOff,
    remoteMuted,
    remoteCameraOff,
    facingMode,
    minimised,
    durationSec,
    notice,
    setMinimised,
    startCall,
    acceptCall,
    declineCall,
    endCall,
    toggleMute,
    toggleCamera,
    switchCamera,
  };
}
