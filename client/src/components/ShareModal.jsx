import { useState } from 'react';
import { Check, Copy, Eye, EyeOff, KeyRound, Link2, X } from 'lucide-react';

export default function ShareModal({ room, passcode, onClose }) {
  const [revealCode, setRevealCode] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  const inviteUrl = `${window.location.origin}/room/${room.publicId}`;

  const copyText = async (text, setter) => {
    try {
      await navigator.clipboard.writeText(text);
      setter(true);
      setTimeout(() => setter(false), 2000);
    } catch {
      const el = document.createElement('textarea');
      el.value = text;
      document.body.appendChild(el);
      el.select();
      document.execCommand('copy');
      document.body.removeChild(el);
      setter(true);
      setTimeout(() => setter(false), 2000);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm animate-fade-up"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-3xl p-6 shadow-2xl glass-elevated"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between">
          <div>
            <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">
              Share Private Chat
            </h3>
            <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
              Share the secret passcode so the other person can connect.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl p-1.5 text-slate-400 hover:bg-slate-900/5 hover:text-slate-700 dark:hover:bg-white/10 dark:hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-5 space-y-4">
          <div className="rounded-2xl border border-sage-500/20 bg-sage-500/[0.07] p-4">
            <div className="mb-2 flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-xs font-medium text-sage-700 dark:text-sage-300">
                <KeyRound className="h-3.5 w-3.5" />
                Secret Passcode
              </span>
              <button
                type="button"
                onClick={() => setRevealCode((v) => !v)}
                className="inline-flex items-center gap-1 text-[11px] text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
              >
                {revealCode ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                {revealCode ? 'Hide' : 'Show'}
              </button>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex-1 truncate rounded-xl bg-white/80 px-3 py-2 font-mono text-sm text-slate-800 dark:bg-dusk-900/80 dark:text-slate-100">
                {revealCode ? passcode : '•'.repeat(Math.min(passcode.length, 18))}
              </div>
              <button
                type="button"
                onClick={() => copyText(passcode, setCopiedCode)}
                className="flex shrink-0 items-center gap-1.5 rounded-xl bg-sage-500 px-3.5 py-2 text-xs font-semibold text-white transition-colors hover:bg-sage-600"
              >
                {copiedCode ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                {copiedCode ? 'Copied' : 'Copy'}
              </button>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-900/10 bg-slate-900/[0.03] p-4 dark:border-white/10 dark:bg-white/[0.03]">
            <div className="mb-2 flex items-center gap-1.5 text-xs font-medium text-slate-700 dark:text-slate-300">
              <Link2 className="h-3.5 w-3.5 text-sage-500" />
              Chat Link
            </div>
            <div className="flex items-center gap-2">
              <div className="flex-1 truncate rounded-xl bg-white/75 px-3 py-2 font-mono text-xs text-slate-600 dark:bg-dusk-900/80 dark:text-slate-300">
                {inviteUrl}
              </div>
              <button
                type="button"
                onClick={() => copyText(inviteUrl, setCopiedLink)}
                className="flex shrink-0 items-center gap-1.5 rounded-xl border border-slate-900/10 bg-white px-3 py-2 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-50 dark:border-white/10 dark:bg-dusk-800 dark:text-slate-200 dark:hover:bg-dusk-700"
              >
                {copiedLink ? <Check className="h-3.5 w-3.5 text-sage-500" /> : <Copy className="h-3.5 w-3.5" />}
                {copiedLink ? 'Copied' : 'Copy'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
