import { Lock, ShieldCheck, X, Cpu, EyeOff, KeyRound } from 'lucide-react';

export default function SecurityModal({ room, fingerprint, onClose }) {
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
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-sage-500/15 text-sage-600 dark:text-sage-300">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                End-to-End Encrypted
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Zero-knowledge client-side cryptography
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl p-1.5 text-slate-400 hover:bg-slate-900/5 hover:text-slate-700 dark:hover:bg-white/10 dark:hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Visual Safety Fingerprint */}
        <div className="mt-5 rounded-2xl border border-sage-500/20 bg-sage-500/10 p-4 text-center">
          <div className="text-[11px] font-medium uppercase tracking-wider text-sage-700 dark:text-sage-300">
            Session Safety Fingerprint
          </div>
          <div className="mt-2 flex items-center justify-center gap-3 text-2xl">
            {fingerprint.glyphs.map((g, idx) => (
              <span key={idx} className="select-none">
                {g}
              </span>
            ))}
          </div>
          <div className="mt-2 font-mono text-sm font-semibold tracking-widest text-slate-800 dark:text-slate-100">
            {fingerprint.hexCode}
          </div>
          <p className="mt-1.5 text-[11px] text-slate-600 dark:text-slate-400">
            Everyone who enters the same secret passcode sees this exact fingerprint.
          </p>
        </div>

        {/* Cryptographic Specs */}
        <div className="mt-5 space-y-3 text-xs text-slate-600 dark:text-slate-300">
          <div className="flex items-start gap-2.5">
            <KeyRound className="mt-0.5 h-4 w-4 shrink-0 text-sage-500 dark:text-sage-400" />
            <div>
              <span className="font-semibold text-slate-800 dark:text-slate-100">
                Passcode Never Transmitted:
              </span>{' '}
              PBKDF2-SHA256 derives separate room lookup hashes and a non-extractable
              256-bit AES-GCM key purely inside your browser.
            </div>
          </div>
          <div className="flex items-start gap-2.5">
            <Lock className="mt-0.5 h-4 w-4 shrink-0 text-sage-500 dark:text-sage-400" />
            <div>
              <span className="font-semibold text-slate-800 dark:text-slate-100">
                Per-Message 96-bit IV:
              </span>{' '}
              Every message text and your ephemeral alias are sealed with a fresh random
              initialization vector before reaching Express or MongoDB.
            </div>
          </div>
          <div className="flex items-start gap-2.5">
            <EyeOff className="mt-0.5 h-4 w-4 shrink-0 text-sage-500 dark:text-sage-400" />
            <div>
              <span className="font-semibold text-slate-800 dark:text-slate-100">
                Zero Identity Footprint:
              </span>{' '}
              No user database, no email, no real credentials.
            </div>
          </div>
          <div className="flex items-center gap-2 rounded-xl bg-slate-900/5 px-3 py-2 font-mono text-[10px] text-slate-500 dark:bg-black/25 dark:text-slate-400">
            <Cpu className="h-3.5 w-3.5 shrink-0 text-sage-500" />
            <span className="truncate">Salt: {room.salt}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
