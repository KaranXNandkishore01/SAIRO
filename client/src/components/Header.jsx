import { Moon, Sun } from 'lucide-react';

export default function Header({ theme, onToggleTheme, onLogoClick }) {
  return (
    <header className="w-full px-4 pt-4 sm:px-6">
      <div className="mx-auto flex max-w-5xl items-center justify-between rounded-2xl px-4 py-2.5 glass-panel">
        <button
          type="button"
          onClick={onLogoClick}
          className="group flex items-center gap-3 text-left focus:outline-none"
          title="SAIRO Home"
        >
          <div className="relative flex h-10 w-10 items-center justify-center overflow-hidden rounded-xl bg-black ring-1 ring-cyan-400/30 shadow-md shadow-cyan-950/30 transition-transform duration-300 group-hover:scale-105">
            <img
              src="/sairo-icon.png"
              alt="SAIRO Logo"
              className="h-full w-full object-cover"
            />
          </div>
          <div>
            <span className="text-sm font-semibold tracking-[0.16em] text-slate-800 dark:text-slate-100">
              SAIRO
            </span>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              Private Encrypted Chat
            </p>
          </div>
        </button>

        <button
          type="button"
          onClick={onToggleTheme}
          aria-label={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
          title={theme === 'dark' ? 'Light theme' : 'Dark theme'}
          className="flex h-9 w-9 items-center justify-center rounded-xl text-slate-600 transition-colors hover:bg-slate-900/5 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-white/10 dark:hover:text-white"
        >
          {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </button>
      </div>
    </header>
  );
}
