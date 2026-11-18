import { Moon, Sun } from 'lucide-react';

export default function Header({ theme, onToggleTheme, onLogoClick }) {
  return (
    <header className="w-full shrink-0 px-2.5 safe-top sm:px-5 sm:pt-4 md:px-6">
      <div className="mx-auto flex max-w-5xl items-center justify-between rounded-2xl px-3 py-2 glass-panel sm:px-4 sm:py-2.5">
        <button
          type="button"
          onClick={onLogoClick}
          className="group flex min-h-[40px] items-center gap-2.5 text-left focus:outline-none sm:gap-3"
          title="SAIRO Home"
        >
          <div className="relative flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-black ring-1 ring-cyan-400/35 shadow-md shadow-cyan-950/40 transition-transform duration-300 group-hover:scale-105 sm:h-10 sm:w-10">
            <img
              src="/sairo-icon.png"
              alt="SAIRO Logo"
              className="h-full w-full object-cover"
            />
          </div>
          <div className="leading-tight">
            <span className="block text-sm font-semibold tracking-[0.16em] text-slate-900 dark:text-[#edf4f3]">
              SAIRO
            </span>
            <p className="text-[11px] text-slate-500 dark:text-[#8ea5ad]">
              Private Encrypted Chat
            </p>
          </div>
        </button>

        <button
          type="button"
          onClick={onToggleTheme}
          aria-label={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
          title={theme === 'dark' ? 'Light theme' : 'Dark theme'}
          className="flex h-10 w-10 items-center justify-center rounded-xl text-slate-600 transition-colors hover:bg-slate-900/5 hover:text-slate-900 dark:text-[#b4c6cc] dark:hover:bg-white/10 dark:hover:text-white"
        >
          {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </button>
      </div>
    </header>
  );
}
