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
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-3.5 backdrop-blur-sm animate-fade-up sm:p-4"
      onClick={onClose}
    >
      <div
        className="max-h-[90dvh] w-full max-w-md overflow-y-auto rounded-3xl p-5 shadow-2xl glass-elevated sm:p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-2">
          <div>
            <h3 className="text-base font-semibold text-slate-900 dark:text-[#edf4f3]">
              Share Private Chat
            </h3>
            <p className="mt-0.5 text-xs text-slate-500 dark:text-[#9bb0b6]">
              Share the secret passcode so the other person can connect.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-slate-400 hover:bg-slate-900/5 hover:text-slate-700 dark:text-[#9bb0b6] dark:hover:bg-white/10 dark:hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-5 space-y-4">
          <div className="rounded-2xl border border-teal-500/20 bg-teal-500/[0.08] p-3.5 dark:border-teal-400/20 dark:bg-teal-400/[0.08] sm:p-4">
            <div className="mb-2 flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-xs font-medium text-teal-700 dark:text-teal-300">
                <KeyRound className="h-3.5 w-3.5" />
                Secret Passcode
              </span>
              <button
                type="button"
                onClick={() => setRevealCode((v) => !v)}
                className="inline-flex min-h-[28px] items-center gap-1 text-[11px] text-slate-500 hover:text-slate-700 dark:text-[#9bb0b6] dark:hover:text-white"
              >
                {revealCode ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                {revealCode ? 'Hide' : 'Show'}
              </button>
            </div>
            <div className="flex items-center gap-2">
              <div className="min-w-0 flex-1 truncate rounded-xl bg-white/85 px-3 py-2.5 font-mono text-sm text-slate-800 dark:bg-[#0d151d]/90 dark:text-[#edf4f3]">
                {revealCode ? passcode : '•'.repeat(Math.min(passcode.length, 18))}
              </div>
              <button
                type="button"
                onClick={() => copyText(passcode, setCopiedCode)}
                className="flex min-h-[40px] shrink-0 items-center gap-1.5 rounded-xl bg-teal-600 px-3.5 py-2 text-xs font-semibold text-white transition-colors hover:bg-teal-500"
              >
                {copiedCode ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                {copiedCode ? 'Copied' : 'Copy'}
              </button>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-900/10 bg-slate-900/[0.03] p-3.5 dark:border-teal-200/10 dark:bg-[#0d151d]/60 sm:p-4">
            <div className="mb-2 flex items-center gap-1.5 text-xs font-medium text-slate-700 dark:text-[#c7d6db]">
              <Link2 className="h-3.5 w-3.5 text-teal-500 dark:text-teal-300" />
              Chat Link
            </div>
            <div className="flex items-center gap-2">
              <div className="min-w-0 flex-1 truncate rounded-xl bg-white/80 px-3 py-2.5 font-mono text-xs text-slate-600 dark:bg-[#0d151d]/90 dark:text-[#b4c6cc]">
                {inviteUrl}
              </div>
              <button
                type="button"
                onClick={() => copyText(inviteUrl, setCopiedLink)}
                className="flex min-h-[40px] shrink-0 items-center gap-1.5 rounded-xl border border-slate-900/10 bg-white px-3 py-2 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-50 dark:border-teal-200/15 dark:bg-[#1a2633] dark:text-[#edf4f3] dark:hover:bg-[#223243]"
              >
                {copiedLink ? <Check className="h-3.5 w-3.5 text-teal-400" /> : <Copy className="h-3.5 w-3.5" />}
                {copiedLink ? 'Copied' : 'Copy'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
