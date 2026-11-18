import { useEffect, useRef } from 'react';
import {
  Maximize2,
  Mic,
  MicOff,
  Minimize2,
  Phone,
  PhoneOff,
  SwitchCamera,
  Video,
  VideoOff,
} from 'lucide-react';
import { getAvatarGradient, getInitials } from '../utils/alias';

function formatDuration(sec) {
  const mins = Math.floor(sec / 60);
  const rem = sec % 60;
  return `${String(mins).padStart(2, '0')}:${String(rem).padStart(2, '0')}`;
}

export default function CallOverlay({ call }) {
  const {
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
    setMinimised,
    acceptCall,
    declineCall,
    endCall,
    toggleMute,
    toggleCamera,
    switchCamera,
  } = call;

  const remoteAudioRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const localVideoRef = useRef(null);

  // Keep remote audio playing reliably (including voice calls & minimised mode)
  useEffect(() => {
    if (remoteAudioRef.current) {
      remoteAudioRef.current.srcObject = remoteStream || null;
      if (remoteStream) {
        remoteAudioRef.current.play().catch(() => {});
      }
    }
  }, [remoteStream, callStatus, minimised]);

  useEffect(() => {
    if (remoteVideoRef.current) {
      remoteVideoRef.current.srcObject = remoteStream || null;
      if (remoteStream) {
        remoteVideoRef.current.play().catch(() => {});
      }
    }
  }, [remoteStream, callStatus, minimised, callType]);

  useEffect(() => {
    if (localVideoRef.current) {
      localVideoRef.current.srcObject = localStream || null;
      if (localStream) {
        localVideoRef.current.play().catch(() => {});
      }
    }
  }, [localStream, callStatus, minimised, isCameraOff, callType]);

  if (callStatus === 'idle') return null;

  const statusLabel =
    callStatus === 'calling'
      ? 'Ringing...'
      : callStatus === 'connecting'
        ? 'Connecting...'
        : callStatus === 'connected'
          ? formatDuration(durationSec)
          : '';

  const avatarGradient = getAvatarGradient(remoteAlias);

  return (
    <>
      {/* Persistent hidden audio element so voice stays active even when minimised */}
      <audio ref={remoteAudioRef} autoPlay playsInline className="hidden" />

      {/* Incoming Call Prompt */}
      {callStatus === 'incoming' && (
        <div className="fixed inset-x-3 top-4 z-50 mx-auto max-w-sm animate-fade-up sm:top-6">
          <div className="rounded-3xl p-4 shadow-2xl shadow-black/50 glass-elevated ring-1 ring-teal-400/25 sm:p-5">
            <div className="flex items-center gap-3.5">
              <div
                className={`relative flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br text-sm font-semibold text-white shadow-md ${avatarGradient}`}
              >
                <span className="absolute -inset-1 animate-ping rounded-2xl bg-teal-400/25" />
                <span className="relative">{getInitials(remoteAlias)}</span>
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-slate-900 dark:text-[#edf4f3]">
                  {remoteAlias}
                </p>
                <p className="mt-0.5 flex items-center gap-1.5 text-xs text-teal-700 dark:text-teal-300">
                  {callType === 'video' ? (
                    <Video className="h-3.5 w-3.5" />
                  ) : (
                    <Phone className="h-3.5 w-3.5" />
                  )}
                  {callType === 'video' ? 'Incoming video call' : 'Incoming voice call'}
                </p>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={declineCall}
                className="flex min-h-[44px] items-center justify-center gap-2 rounded-2xl bg-rose-500/15 px-4 py-2.5 text-xs font-semibold text-rose-600 transition-colors hover:bg-rose-500/25 dark:bg-rose-500/20 dark:text-rose-200"
              >
                <PhoneOff className="h-4 w-4" />
                Decline
              </button>
              <button
                type="button"
                onClick={acceptCall}
                className="flex min-h-[44px] items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-teal-500 to-emerald-600 px-4 py-2.5 text-xs font-semibold text-white shadow-md shadow-teal-950/30 transition-all hover:brightness-105"
              >
                {callType === 'video' ? (
                  <Video className="h-4 w-4" />
                ) : (
                  <Phone className="h-4 w-4" />
                )}
                Accept
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Minimised Floating Call Pill (lets users chat while on call) */}
      {callStatus !== 'incoming' && minimised && (
        <div className="fixed inset-x-3 top-3 z-50 mx-auto max-w-md animate-fade-up sm:top-4">
          <div className="flex items-center justify-between gap-2 rounded-2xl px-3.5 py-2.5 shadow-2xl shadow-black/45 glass-elevated ring-1 ring-teal-400/25">
            <button
              type="button"
              onClick={() => setMinimised(false)}
              className="flex min-w-0 flex-1 items-center gap-2.5 text-left"
            >
              <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-emerald-400 animate-pulse-gentle" />
              <div className="min-w-0">
                <p className="truncate text-xs font-semibold text-slate-900 dark:text-[#edf4f3]">
                  {remoteAlias}
                </p>
                <p className="text-[11px] text-teal-700 dark:text-teal-300">
                  {callType === 'video' ? 'Video call' : 'Voice call'} • {statusLabel}
                </p>
              </div>
            </button>

            <div className="flex shrink-0 items-center gap-1.5">
              <button
                type="button"
                onClick={toggleMute}
                aria-label={isMuted ? 'Unmute microphone' : 'Mute microphone'}
                className={`flex h-9 w-9 items-center justify-center rounded-xl transition-colors ${
                  isMuted
                    ? 'bg-rose-500/20 text-rose-500 dark:text-rose-300'
                    : 'bg-slate-900/5 text-slate-700 hover:bg-slate-900/10 dark:bg-white/10 dark:text-[#edf4f3]'
                }`}
              >
                {isMuted ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
              </button>

              <button
                type="button"
                onClick={() => setMinimised(false)}
                aria-label="Expand call"
                className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-900/5 text-slate-700 hover:bg-slate-900/10 dark:bg-white/10 dark:text-[#edf4f3]"
              >
                <Maximize2 className="h-4 w-4" />
              </button>

              <button
                type="button"
                onClick={endCall}
                aria-label="End call"
                className="flex h-9 w-9 items-center justify-center rounded-xl bg-rose-500 text-white hover:bg-rose-600"
              >
                <PhoneOff className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Full Active Call Overlay */}
      {callStatus !== 'incoming' && !minimised && (
        <div className="fixed inset-0 z-50 flex flex-col bg-[#080d12]/95 text-[#edf4f3] backdrop-blur-xl animate-fade-up">
          {/* Top Call Header */}
          <div className="flex shrink-0 items-center justify-between px-4 pb-2 safe-top sm:px-6 sm:pt-5">
            <div className="min-w-0">
              <h3 className="truncate text-base font-semibold text-[#edf4f3]">
                {remoteAlias}
              </h3>
              <div className="mt-0.5 flex items-center gap-2 text-xs text-teal-300">
                <span
                  className={`h-2 w-2 rounded-full ${
                    callStatus === 'connected'
                      ? 'bg-emerald-400 animate-pulse-gentle'
                      : 'bg-amber-400 animate-pulse'
                  }`}
                />
                <span>{statusLabel}</span>
                {remoteMuted && callStatus === 'connected' && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-white/10 px-2 py-0.5 text-[10px] text-[#c4d4d9]">
                    <MicOff className="h-2.5 w-2.5" />
                    Muted
                  </span>
                )}
              </div>
            </div>

            <button
              type="button"
              onClick={() => setMinimised(true)}
              aria-label="Minimise call to continue chatting"
              title="Minimise to chat"
              className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/10 text-[#edf4f3] transition-colors hover:bg-white/15"
            >
              <Minimize2 className="h-4 w-4" />
            </button>
          </div>

          {/* Centre Stage: Video or Voice */}
          <div className="relative flex min-h-0 flex-1 items-center justify-center p-3 sm:p-6">
            {callType === 'video' ? (
              <div className="relative flex h-full w-full max-w-4xl items-center justify-center overflow-hidden rounded-3xl bg-[#101820] ring-1 ring-teal-200/15">
                {/* Remote Video */}
                <video
                  ref={remoteVideoRef}
                  autoPlay
                  playsInline
                  muted
                  className={`h-full w-full object-cover transition-opacity duration-300 ${
                    callStatus === 'connected' && !remoteCameraOff
                      ? 'opacity-100'
                      : 'opacity-0'
                  }`}
                />

                {/* Fallback Avatar when ringing or remote camera off */}
                {(callStatus !== 'connected' || remoteCameraOff) && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center">
                    <div
                      className={`flex h-24 w-24 items-center justify-center rounded-3xl bg-gradient-to-br text-2xl font-semibold text-white shadow-2xl sm:h-28 sm:w-28 ${avatarGradient}`}
                    >
                      {getInitials(remoteAlias)}
                    </div>
                    <p className="mt-4 text-sm text-[#9bb0b6]">
                      {callStatus === 'connected'
                        ? 'Camera is turned off'
                        : statusLabel}
                    </p>
                  </div>
                )}

                {/* Self-View Picture-in-Picture */}
                <div className="absolute bottom-3 right-3 h-36 w-28 overflow-hidden rounded-2xl bg-[#0a0f14] shadow-2xl ring-1 ring-white/20 sm:bottom-4 sm:right-4 sm:h-36 sm:w-52">
                  {!isCameraOff ? (
                    <video
                      ref={localVideoRef}
                      autoPlay
                      playsInline
                      muted
                      className={`h-full w-full object-cover ${
                        facingMode === 'user' ? '-scale-x-100' : ''
                      }`}
                    />
                  ) : (
                    <div className="flex h-full w-full flex-col items-center justify-center gap-1 text-[11px] text-[#8ea5ad]">
                      <VideoOff className="h-5 w-5" />
                      <span>You</span>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              /* Soothing Voice Call Stage */
              <div className="flex flex-col items-center justify-center text-center">
                <div className="relative flex items-center justify-center">
                  <span
                    className={`absolute -inset-6 rounded-full bg-teal-400/10 blur-xl ${
                      callStatus === 'connected' ? 'animate-pulse-gentle' : 'animate-ping'
                    }`}
                  />
                  <span className="absolute -inset-2.5 rounded-full border border-teal-400/25" />
                  <div
                    className={`relative flex h-28 w-28 items-center justify-center rounded-full bg-gradient-to-br text-3xl font-semibold text-white shadow-2xl sm:h-32 sm:w-32 ${avatarGradient}`}
                  >
                    {getInitials(remoteAlias)}
                  </div>
                </div>
                <p className="mt-6 text-lg font-semibold text-[#edf4f3]">{remoteAlias}</p>
                <p className="mt-1 text-sm text-teal-300">{statusLabel}</p>
              </div>
            )}
          </div>

          {/* Bottom Touch-Friendly Call Controls */}
          <div className="flex shrink-0 items-center justify-center gap-3 px-4 pt-2 safe-bottom sm:gap-4 sm:pb-8">
            <button
              type="button"
              onClick={toggleMute}
              aria-label={isMuted ? 'Unmute microphone' : 'Mute microphone'}
              title={isMuted ? 'Unmute' : 'Mute'}
              className={`flex h-14 w-14 items-center justify-center rounded-2xl transition-all ${
                isMuted
                  ? 'bg-white text-[#0a0f14]'
                  : 'bg-white/10 text-[#edf4f3] hover:bg-white/15'
              }`}
            >
              {isMuted ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
            </button>

            {callType === 'video' && (
              <>
                <button
                  type="button"
                  onClick={toggleCamera}
                  aria-label={isCameraOff ? 'Turn camera on' : 'Turn camera off'}
                  title={isCameraOff ? 'Camera on' : 'Camera off'}
                  className={`flex h-14 w-14 items-center justify-center rounded-2xl transition-all ${
                    isCameraOff
                      ? 'bg-white text-[#0a0f14]'
                      : 'bg-white/10 text-[#edf4f3] hover:bg-white/15'
                  }`}
                >
                  {isCameraOff ? (
                    <VideoOff className="h-5 w-5" />
                  ) : (
                    <Video className="h-5 w-5" />
                  )}
                </button>

                <button
                  type="button"
                  onClick={switchCamera}
                  aria-label="Switch camera"
                  title="Switch camera"
                  className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/10 text-[#edf4f3] transition-all hover:bg-white/15"
                >
                  <SwitchCamera className="h-5 w-5" />
                </button>
              </>
            )}

            <button
              type="button"
              onClick={endCall}
              aria-label="End call"
              title="End call"
              className="flex h-14 w-14 items-center justify-center rounded-2xl bg-rose-500 text-white shadow-lg shadow-rose-950/40 transition-all hover:bg-rose-600"
            >
              <PhoneOff className="h-5 w-5" />
            </button>
          </div>
        </div>
      )}
    </>
  );
}
