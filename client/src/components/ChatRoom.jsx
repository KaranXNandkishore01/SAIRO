import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Check,
  Copy,
  LogOut,
  Phone,
  PhoneOff,
  Send,
  Share2,
  Trash2,
  Users,
  Video,
  X,
} from 'lucide-react';
import { decryptMessagePayload, encryptMessagePayload } from '../crypto/e2ee';
import { api } from '../services/api';
import { createChatSocket } from '../services/socket';
import { useWebRTCCall } from '../hooks/useWebRTCCall';
import MessageBubble from './MessageBubble';
import ShareModal from './ShareModal';
import CallOverlay from './CallOverlay';

export default function ChatRoom({
  session,
  sessionId,
  onLeave,
  onComposerFocus,
  onComposerBlur,
}) {
  const { room, passcode, authVerifier, aesKey, alias } = session;

  const [messages, setMessages] = useState([]);
  const [systemEvents, setSystemEvents] = useState([]);
  const [participantCount, setParticipantCount] = useState(1);
  const [connectionState, setConnectionState] = useState('connecting');
  const [burnedReason, setBurnedReason] = useState('');

  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [replyTarget, setReplyTarget] = useState(null);
  const [typingPeers, setTypingPeers] = useState(() => new Set());

  const [showShare, setShowShare] = useState(false);
  const [confirmBurn, setConfirmBurn] = useState(false);
  const [quickCopied, setQuickCopied] = useState(false);
  const [activeSocket, setActiveSocket] = useState(null);

  const socketRef = useRef(null);
  const endOfMessagesRef = useRef(null);
  const inputRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const isTypingRef = useRef(false);

  const call = useWebRTCCall({
    socket: activeSocket,
    aesKey,
    alias,
    participantCount,
  });

  const decryptOne = useCallback(
    async (rawMsg) => {
      try {
        const data = await decryptMessagePayload(aesKey, rawMsg.iv, rawMsg.ciphertext);
        return {
          _id: rawMsg._id,
          senderSessionId: rawMsg.senderSessionId,
          createdAt: rawMsg.createdAt,
          text: data.text || '',
          alias: data.alias || 'Anonymous',
          replyTo: data.replyTo || null,
          decryptionFailed: false,
        };
      } catch {
        return {
          _id: rawMsg._id,
          senderSessionId: rawMsg.senderSessionId,
          createdAt: rawMsg.createdAt,
          text: '',
          alias: 'Anonymous',
          replyTo: null,
          decryptionFailed: true,
        };
      }
    },
    [aesKey]
  );

  useEffect(() => {
    const socket = createChatSocket();
    socketRef.current = socket;
    setActiveSocket(socket);

    const joinRoom = () => {
      socket.emit(
        'room:join',
        {
          roomHash: room.roomHash,
          authVerifier,
          sessionId,
        },
        (res) => {
          if (res?.ok) {
            setConnectionState('connected');
            if (typeof res.participantCount === 'number') {
              setParticipantCount(res.participantCount);
            }
          } else {
            setConnectionState('burned');
            setBurnedReason(res?.error || 'Could not connect to this chat.');
          }
        }
      );
    };

    socket.on('connect', joinRoom);
    if (socket.connected) {
      joinRoom();
    }

    socket.on('connect_error', () => {
      setConnectionState((prev) => (prev === 'burned' ? 'burned' : 'reconnecting'));
    });

    socket.on('disconnect', () => {
      setConnectionState((prev) => (prev === 'burned' ? 'burned' : 'reconnecting'));
    });

    socket.on('room:presence', ({ participantCount: count }) => {
      if (typeof count === 'number') {
        setParticipantCount(count);
      }
    });

    socket.on('room:peer-event', ({ type, timestamp }) => {
      setSystemEvents((prev) => [
        ...prev.slice(-15),
        {
          id: `${type}-${timestamp}-${Math.random()}`,
          text: type === 'joined' ? 'Someone joined the chat' : 'Someone left the chat',
          createdAt: timestamp,
        },
      ]);
    });

    socket.on('message:new', async (rawMsg) => {
      const decrypted = await decryptOne(rawMsg);
      setMessages((prev) => {
        if (prev.some((m) => m._id === decrypted._id)) return prev;
        return [...prev, decrypted];
      });
    });

    socket.on('typing:update', ({ sessionId: peerId, isTyping }) => {
      if (!peerId || peerId === sessionId) return;
      setTypingPeers((prev) => {
        const next = new Set(prev);
        if (isTyping) next.add(peerId);
        else next.delete(peerId);
        return next;
      });
    });

    socket.on('room:burned', () => {
      setConnectionState('burned');
      setBurnedReason('This chat has been deleted.');
    });

    return () => {
      clearTimeout(typingTimeoutRef.current);
      socket.emit('room:leave');
      socket.disconnect();
      socketRef.current = null;
      setActiveSocket(null);
    };
  }, [room.roomHash, authVerifier, sessionId, decryptOne]);

  const timeline = useMemo(() => {
    const combined = [
      ...messages.map((m) => ({ kind: 'message', sortAt: new Date(m.createdAt).getTime(), data: m })),
      ...systemEvents.map((e) => ({ kind: 'event', sortAt: e.createdAt, data: e })),
    ];
    combined.sort((a, b) => a.sortAt - b.sortAt);
    return combined;
  }, [messages, systemEvents]);

  useEffect(() => {
    endOfMessagesRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [timeline.length, typingPeers.size]);

  const stopTypingNow = () => {
    if (isTypingRef.current && socketRef.current) {
      socketRef.current.emit('typing:stop');
      isTypingRef.current = false;
    }
    clearTimeout(typingTimeoutRef.current);
  };

  const handleDraftChange = (e) => {
    const val = e.target.value;
    setDraft(val);

    e.target.style.height = 'auto';
    e.target.style.height = `${Math.min(e.target.scrollHeight, 128)}px`;

    if (!socketRef.current || connectionState !== 'connected') return;

    if (val.trim().length > 0) {
      if (!isTypingRef.current) {
        socketRef.current.emit('typing:start');
        isTypingRef.current = true;
      }
      clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = setTimeout(() => {
        stopTypingNow();
      }, 1800);
    } else {
      stopTypingNow();
    }
  };

  const handleSend = async (e) => {
    e?.preventDefault();
    const cleanText = draft.trim();
    if (!cleanText || sending || connectionState !== 'connected') return;

    setSending(true);
    stopTypingNow();

    try {
      const payload = {
        text: cleanText,
        alias,
        sentAt: Date.now(),
        ...(replyTarget
          ? {
              replyTo: {
                id: replyTarget._id,
                alias: replyTarget.alias,
                preview: replyTarget.text.slice(0, 120),
              },
            }
          : {}),
      };

      const { iv, ciphertext } = await encryptMessagePayload(aesKey, payload);

      await new Promise((resolve, reject) => {
        socketRef.current.emit('message:send', { iv, ciphertext }, (ack) => {
          if (ack?.ok) resolve(ack);
          else reject(new Error(ack?.error || 'Could not send message'));
        });
      });

      setDraft('');
      setReplyTarget(null);
      if (inputRef.current) {
        inputRef.current.style.height = 'auto';
        inputRef.current.focus();
      }
    } catch (err) {
      console.error('Send error:', err);
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleBurnRoom = async () => {
    try {
      await api.burnRoom(room.roomHash, authVerifier);
      setConfirmBurn(false);
      onLeave();
    } catch (err) {
      console.error('Delete chat error:', err);
      setConfirmBurn(false);
    }
  };

  const handleQuickCopyPasscode = async () => {
    try {
      await navigator.clipboard.writeText(passcode);
      setQuickCopied(true);
      setTimeout(() => setQuickCopied(false), 2000);
    } catch {
      setShowShare(true);
    }
  };

  return (
    <main className="mx-auto flex min-h-0 w-full max-w-5xl flex-1 flex-col px-2.5 py-2 sm:px-5 sm:py-3 md:px-6">
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl shadow-2xl shadow-black/25 glass-panel sm:rounded-3xl">
        {/* Clean Minimal Top Bar */}
        <div className="flex shrink-0 items-center justify-between gap-2 border-b border-slate-900/5 px-3.5 py-2.5 dark:border-teal-200/10 sm:px-5 sm:py-3">
          <div className="flex min-w-0 items-center gap-2.5">
            <span
              className={`h-2.5 w-2.5 shrink-0 rounded-full ${
                connectionState === 'connected'
                  ? 'bg-emerald-400 animate-pulse-gentle'
                  : connectionState === 'burned'
                    ? 'bg-rose-400'
                    : 'bg-amber-400'
              }`}
            />
            <span className="truncate text-xs font-medium text-slate-800 dark:text-[#e6f0ef] sm:text-sm">
              {connectionState === 'connected'
                ? participantCount === 1
                  ? 'Waiting for the other person'
                  : `${participantCount} connected`
                : connectionState === 'reconnecting'
                  ? 'Reconnecting...'
                  : connectionState === 'burned'
                    ? 'Chat ended'
                    : 'Connecting...'}
            </span>
          </div>

          <div className="flex shrink-0 items-center gap-1 sm:gap-1.5">
            {call.callStatus !== 'idle' ? (
              <div className="flex items-center gap-1 sm:gap-1.5">
                {call.callStatus === 'connected' && (
                  <button
                    type="button"
                    onClick={call.toggleCallType}
                    className="flex h-10 w-10 items-center justify-center rounded-xl bg-teal-500/15 text-teal-700 transition-colors hover:bg-teal-500/25 dark:bg-teal-400/15 dark:text-teal-200"
                    title={
                      call.callType === 'video'
                        ? 'Switch to voice call'
                        : 'Switch to video call'
                    }
                    aria-label={
                      call.callType === 'video'
                        ? 'Switch to voice call'
                        : 'Switch to video call'
                    }
                  >
                    {call.callType === 'video' ? (
                      <Phone className="h-4 w-4" />
                    ) : (
                      <Video className="h-4 w-4" />
                    )}
                  </button>
                )}

                <button
                  type="button"
                  onClick={call.endCall}
                  className="flex min-h-[38px] items-center gap-1.5 rounded-xl bg-rose-500 px-3 py-1.5 text-xs font-semibold text-white shadow-md shadow-rose-950/30 transition-all hover:bg-rose-600"
                  title={
                    call.callStatus === 'calling'
                      ? 'Cancel outgoing call'
                      : 'Cut active call'
                  }
                  aria-label="Cut call"
                >
                  <PhoneOff className="h-3.5 w-3.5" />
                  <span>
                    {call.callStatus === 'calling' ? 'Cancel Call' : 'Cut Call'}
                  </span>
                </button>
              </div>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => call.startCall('audio')}
                  disabled={connectionState !== 'connected'}
                  aria-label="Start voice call"
                  title={
                    participantCount < 2
                      ? 'Wait for the other person to join before calling'
                      : 'Start voice call'
                  }
                  className="flex h-10 w-10 items-center justify-center rounded-xl text-teal-700 transition-colors hover:bg-teal-500/15 disabled:cursor-not-allowed disabled:opacity-35 dark:text-teal-300 dark:hover:bg-teal-400/15"
                >
                  <Phone className="h-4 w-4" />
                </button>

                <button
                  type="button"
                  onClick={() => call.startCall('video')}
                  disabled={connectionState !== 'connected'}
                  aria-label="Start video call"
                  title={
                    participantCount < 2
                      ? 'Wait for the other person to join before calling'
                      : 'Start video call'
                  }
                  className="flex h-10 w-10 items-center justify-center rounded-xl text-teal-700 transition-colors hover:bg-teal-500/15 disabled:cursor-not-allowed disabled:opacity-35 dark:text-teal-300 dark:hover:bg-teal-400/15"
                >
                  <Video className="h-4 w-4" />
                </button>
              </>
            )}

            <button
              type="button"
              onClick={() => setShowShare(true)}
              className="flex min-h-[38px] items-center gap-1.5 rounded-xl bg-teal-500/15 px-3 py-1.5 text-xs font-medium text-teal-700 transition-colors hover:bg-teal-500/25 dark:bg-teal-400/15 dark:text-teal-200 dark:hover:bg-teal-400/25"
              title="Share passcode"
            >
              <Share2 className="h-3.5 w-3.5" />
              <span className="hidden xs:inline sm:inline">Share</span>
            </button>

            <button
              type="button"
              onClick={() => setConfirmBurn(true)}
              disabled={connectionState === 'burned'}
              className="flex h-10 w-10 items-center justify-center rounded-xl text-slate-500 transition-colors hover:bg-rose-500/10 hover:text-rose-500 disabled:opacity-40 dark:text-[#9bb0b6] dark:hover:bg-rose-500/15 dark:hover:text-rose-300"
              title="Delete chat"
            >
              <Trash2 className="h-4 w-4" />
            </button>

            <button
              type="button"
              onClick={onLeave}
              className="flex h-10 w-10 items-center justify-center rounded-xl text-slate-500 transition-colors hover:bg-slate-900/5 hover:text-slate-800 dark:text-[#9bb0b6] dark:hover:bg-white/10 dark:hover:text-white"
              title="Leave chat"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Subtle Call Status Notice */}
        {call.notice && (
          <div className="shrink-0 border-b border-teal-500/15 bg-teal-500/10 px-4 py-2 text-center text-xs text-teal-800 dark:border-teal-400/15 dark:bg-teal-400/10 dark:text-teal-200 animate-fade-up">
            {call.notice}
          </div>
        )}

        {/* Scrollable Message Stream */}
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 py-4 sm:px-5 sm:py-5 md:px-6">
          <div className="space-y-3">
              {timeline.length === 0 &&
                participantCount === 1 &&
                connectionState === 'connected' && (
                  <div className="mx-auto my-10 flex max-w-xs flex-col items-center px-4 text-center sm:my-14">
                    <div className="mb-3 h-12 w-12 overflow-hidden rounded-2xl bg-black shadow-md shadow-cyan-950/40 ring-1 ring-cyan-400/35">
                      <img
                        src="/sairo-icon.png"
                        alt="SAIRO"
                        className="h-full w-full object-cover"
                      />
                    </div>
                    <p className="text-sm text-slate-600 dark:text-[#b4c6cc]">
                      Share your secret passcode to connect.
                    </p>
                    <button
                      type="button"
                      onClick={handleQuickCopyPasscode}
                      className="mt-3.5 inline-flex min-h-[40px] items-center gap-1.5 rounded-xl bg-teal-500/15 px-4 py-2 text-xs font-medium text-teal-700 transition-colors hover:bg-teal-500/25 dark:bg-teal-400/15 dark:text-teal-200 dark:hover:bg-teal-400/25"
                    >
                      {quickCopied ? (
                        <Check className="h-3.5 w-3.5 text-emerald-400" />
                      ) : (
                        <Copy className="h-3.5 w-3.5" />
                      )}
                      {quickCopied ? 'Passcode copied' : 'Copy Passcode'}
                    </button>
                  </div>
                )}

              {timeline.map((item, idx) => {
                if (item.kind === 'event') {
                  return (
                    <div
                      key={item.data.id}
                      className="flex items-center justify-center py-1 animate-fade-up"
                    >
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-900/5 px-3 py-1 text-[11px] text-slate-500 dark:bg-white/[0.06] dark:text-[#9bb0b6]">
                        <Users className="h-3 w-3 opacity-75" />
                        {item.data.text}
                      </span>
                    </div>
                  );
                }

                const msg = item.data;
                const prevItem = timeline[idx - 1];
                const samePrevSender =
                  prevItem?.kind === 'message' &&
                  prevItem.data.senderSessionId === msg.senderSessionId &&
                  item.sortAt - prevItem.sortAt < 180_000;

                return (
                  <MessageBubble
                    key={msg._id}
                    message={msg}
                    isMine={msg.senderSessionId === sessionId}
                    showSenderHeader={!samePrevSender}
                    onReply={(target) => {
                      setReplyTarget(target);
                      inputRef.current?.focus();
                    }}
                  />
                );
              })}

              {typingPeers.size > 0 && (
                <div className="flex items-center gap-2 pl-9 pt-1 text-xs text-slate-500 dark:text-[#9bb0b6] animate-fade-up sm:pl-10">
                  <div className="flex items-center gap-1 rounded-2xl bg-white/80 px-3 py-2 dark:bg-[#1a2633]">
                    <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-teal-400 [animation-delay:-0.25s]" />
                    <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-teal-400 [animation-delay:-0.12s]" />
                    <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-teal-400" />
                  </div>
                  <span className="text-[11px]">Typing...</span>
                </div>
              )}

              <div ref={endOfMessagesRef} />
            </div>
        </div>

        {/* Ended Banner or Responsive Composer */}
        {connectionState === 'burned' ? (
          <div className="shrink-0 border-t border-rose-500/20 bg-rose-500/10 px-4 py-4 text-center">
            <p className="text-sm font-medium text-rose-700 dark:text-rose-200">
              {burnedReason || 'This chat has ended.'}
            </p>
            <button
              type="button"
              onClick={onLeave}
              className="mt-3 min-h-[40px] rounded-xl bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800 dark:bg-[#edf4f3] dark:text-[#0a0f14]"
            >
              Go Home
            </button>
          </div>
        ) : (
          <div className="shrink-0 border-t border-slate-900/5 px-2.5 py-2.5 dark:border-teal-200/10 sm:px-5 sm:py-3">
            {replyTarget && (
              <div className="mb-2 flex items-center justify-between rounded-2xl border border-teal-500/20 bg-teal-500/10 px-3 py-2 text-xs dark:border-teal-400/20 dark:bg-teal-400/10">
                <div className="min-w-0 pr-3">
                  <span className="font-semibold text-teal-700 dark:text-teal-300">
                    Replying to {replyTarget.alias}
                  </span>
                  <p className="truncate text-slate-600 dark:text-[#c7d6db]">
                    {replyTarget.text}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setReplyTarget(null)}
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-slate-500 hover:bg-black/5 dark:text-[#b4c6cc] dark:hover:bg-white/10"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            )}

            <form
              onSubmit={handleSend}
              className="flex items-end gap-2 rounded-2xl border border-slate-900/10 bg-white/85 p-1.5 shadow-sm focus-within:border-teal-500/70 focus-within:ring-2 focus-within:ring-teal-500/20 dark:border-teal-200/15 dark:bg-[#0d151d]/95 dark:focus-within:border-teal-400/70 dark:focus-within:ring-teal-400/20"
            >
              <textarea
                ref={inputRef}
                rows={1}
                value={draft}
                onChange={handleDraftChange}
                onKeyDown={handleKeyDown}
                onFocus={onComposerFocus}
                onBlur={onComposerBlur}
                placeholder="Type a message..."
                className="max-h-32 flex-1 resize-none bg-transparent px-3 py-2 text-base text-slate-900 placeholder:text-slate-400 focus:outline-none dark:text-[#edf4f3] dark:placeholder:text-[#6f8690] sm:text-sm"
              />
              <button
                type="submit"
                onMouseDown={(e) => e.preventDefault()}
                disabled={!draft.trim() || sending || connectionState !== 'connected'}
                aria-label="Send message"
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-teal-500 to-cyan-600 text-white shadow-md shadow-teal-950/30 transition-all hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-40 dark:from-teal-500 dark:to-cyan-600 sm:h-10 sm:w-10"
              >
                <Send className="h-4 w-4" />
              </button>
            </form>
          </div>
        )}
      </div>

      {showShare && (
        <ShareModal
          room={room}
          passcode={passcode}
          onClose={() => setShowShare(false)}
        />
      )}

      <CallOverlay call={call} />

      {confirmBurn && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm animate-fade-up"
          onClick={() => setConfirmBurn(false)}
        >
          <div
            className="max-h-[90dvh] w-full max-w-sm overflow-y-auto rounded-3xl p-5 shadow-2xl glass-elevated sm:p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-rose-500/15 text-rose-500 dark:text-rose-400">
              <Trash2 className="h-5 w-5" />
            </div>
            <h3 className="mt-4 text-base font-semibold text-slate-900 dark:text-[#edf4f3]">
              Delete this chat?
            </h3>
            <p className="mt-1.5 text-xs leading-relaxed text-slate-500 dark:text-[#9bb0b6]">
              All messages will be permanently deleted and everyone will be disconnected.
            </p>
            <div className="mt-5 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirmBurn(false)}
                className="min-h-[40px] rounded-xl px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-900/5 dark:text-[#b4c6cc] dark:hover:bg-white/10"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleBurnRoom}
                className="min-h-[40px] rounded-xl bg-rose-500 px-4 py-2 text-xs font-semibold text-white hover:bg-rose-600"
              >
                Delete Chat
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
