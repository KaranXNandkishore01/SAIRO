import { Reply, ShieldAlert } from 'lucide-react';
import { getAvatarGradient, getInitials } from '../utils/alias';

function formatTime(dateInput) {
  try {
    return new Intl.DateTimeFormat('en-IN', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    }).format(new Date(dateInput));
  } catch {
    return '';
  }
}

export default function MessageBubble({
  message,
  isMine,
  showSenderHeader,
  onReply,
}) {
  const gradient = getAvatarGradient(message.senderSessionId || message.alias);

  return (
    <div
      className={`group flex w-full gap-2.5 animate-fade-up ${
        isMine ? 'justify-end' : 'justify-start'
      }`}
    >
      {!isMine && (
        <div className="w-8 shrink-0">
          {showSenderHeader && (
            <div
              className={`flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br text-[11px] font-semibold text-white shadow-sm ${gradient}`}
              title={message.alias}
            >
              {getInitials(message.alias)}
            </div>
          )}
        </div>
      )}

      <div
        className={`flex max-w-[82%] flex-col sm:max-w-[70%] ${
          isMine ? 'items-end' : 'items-start'
        }`}
      >
        {showSenderHeader && !isMine && (
          <div className="mb-1 px-1">
            <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
              {message.alias}
            </span>
          </div>
        )}

        <div className="relative flex items-end gap-1.5">
          {isMine && !message.decryptionFailed && (
            <button
              type="button"
              onClick={() => onReply(message)}
              title="Reply"
              className="mb-1 rounded-lg p-1.5 text-slate-400 opacity-0 transition-opacity hover:bg-slate-900/5 hover:text-slate-600 group-hover:opacity-100 dark:hover:bg-white/10 dark:hover:text-slate-200"
            >
              <Reply className="h-3.5 w-3.5" />
            </button>
          )}

          <div
            className={`rounded-2xl px-4 py-2.5 text-sm leading-relaxed shadow-sm ${
              message.decryptionFailed
                ? 'border border-rose-500/25 bg-rose-500/10 text-rose-700 dark:text-rose-200'
                : isMine
                  ? 'rounded-br-md bg-gradient-to-br from-sage-500 to-teal-600 text-white shadow-sage-950/15'
                  : 'rounded-bl-md border border-slate-900/5 bg-white/85 text-slate-800 dark:border-white/10 dark:bg-dusk-800/90 dark:text-slate-100'
            }`}
          >
            {message.replyTo && (
              <div
                className={`mb-2 rounded-xl border-l-2 px-2.5 py-1.5 text-xs ${
                  isMine
                    ? 'border-white/60 bg-black/15 text-white/90'
                    : 'border-sage-400 bg-sage-500/10 text-slate-600 dark:text-slate-300'
                }`}
              >
                <div className="font-medium opacity-85">{message.replyTo.alias}</div>
                <div className="line-clamp-2 opacity-80">{message.replyTo.preview}</div>
              </div>
            )}

            {message.decryptionFailed ? (
              <div className="flex items-center gap-2 text-xs">
                <ShieldAlert className="h-4 w-4 shrink-0" />
                <span>Could not unlock this message.</span>
              </div>
            ) : (
              <p className="whitespace-pre-wrap break-words">{message.text}</p>
            )}

            <div
              className={`mt-1 flex items-center justify-end text-[10px] ${
                isMine ? 'text-white/75' : 'text-slate-400 dark:text-slate-500'
              }`}
            >
              <span>{formatTime(message.createdAt)}</span>
            </div>
          </div>

          {!isMine && !message.decryptionFailed && (
            <button
              type="button"
              onClick={() => onReply(message)}
              title="Reply"
              className="mb-1 rounded-lg p-1.5 text-slate-400 opacity-0 transition-opacity hover:bg-slate-900/5 hover:text-slate-600 group-hover:opacity-100 dark:hover:bg-white/10 dark:hover:text-slate-200"
            >
              <Reply className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
