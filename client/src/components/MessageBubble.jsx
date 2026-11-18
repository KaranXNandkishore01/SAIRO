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
      className={`group flex w-full gap-2 animate-fade-up sm:gap-2.5 ${
        isMine ? 'justify-end' : 'justify-start'
      }`}
    >
      {!isMine && (
        <div className="w-7 shrink-0 sm:w-8">
          {showSenderHeader && (
            <div
              className={`flex h-7 w-7 items-center justify-center rounded-xl bg-gradient-to-br text-[10px] font-semibold text-white shadow-sm sm:h-8 sm:w-8 sm:text-[11px] ${gradient}`}
              title={message.alias}
            >
              {getInitials(message.alias)}
            </div>
          )}
        </div>
      )}

      <div
        className={`flex max-w-[85%] flex-col sm:max-w-[75%] md:max-w-[68%] ${
          isMine ? 'items-end' : 'items-start'
        }`}
      >
        {showSenderHeader && !isMine && (
          <div className="mb-1 px-1">
            <span className="text-[11px] font-medium text-slate-500 dark:text-[#8ea5ad]">
              {message.alias}
            </span>
          </div>
        )}

        <div className="relative flex items-end gap-1 sm:gap-1.5">
          {isMine && !message.decryptionFailed && (
            <button
              type="button"
              onClick={() => onReply(message)}
              title="Reply"
              className="mb-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-slate-400 opacity-65 transition-opacity hover:bg-slate-900/5 hover:text-slate-600 dark:text-[#7c949c] dark:hover:bg-white/10 dark:hover:text-[#edf4f3] sm:opacity-0 sm:group-hover:opacity-100"
            >
              <Reply className="h-3.5 w-3.5" />
            </button>
          )}

          <div
            className={`min-w-0 rounded-2xl px-3.5 py-2.5 text-[15px] leading-relaxed shadow-sm sm:px-4 sm:text-sm ${
              message.decryptionFailed
                ? 'border border-rose-500/25 bg-rose-500/10 text-rose-700 dark:text-rose-200'
                : isMine
                  ? 'rounded-br-md bg-gradient-to-br from-teal-600 to-cyan-700 text-[#f3fbfa] shadow-teal-950/25 dark:from-teal-600/90 dark:to-cyan-700/90 dark:ring-1 dark:ring-teal-300/20'
                  : 'rounded-bl-md border border-slate-900/5 bg-white/90 text-slate-800 dark:border-teal-200/10 dark:bg-[#1a2633] dark:text-[#e8f1f0]'
            }`}
          >
            {message.replyTo && (
              <div
                className={`mb-2 rounded-xl border-l-2 px-2.5 py-1.5 text-xs ${
                  isMine
                    ? 'border-white/60 bg-black/20 text-white/90'
                    : 'border-teal-400 bg-teal-500/10 text-slate-600 dark:bg-teal-400/10 dark:text-[#c7d7dc]'
                }`}
              >
                <div className="font-medium opacity-90">{message.replyTo.alias}</div>
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
                isMine ? 'text-teal-50/75' : 'text-slate-400 dark:text-[#7c949c]'
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
              className="mb-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-slate-400 opacity-65 transition-opacity hover:bg-slate-900/5 hover:text-slate-600 dark:text-[#7c949c] dark:hover:bg-white/10 dark:hover:text-[#edf4f3] sm:opacity-0 sm:group-hover:opacity-100"
            >
              <Reply className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
