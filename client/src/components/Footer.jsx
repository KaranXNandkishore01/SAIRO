export default function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className="w-full px-4 pb-4 pt-2 sm:px-6">
      <div className="mx-auto flex max-w-5xl flex-col items-center justify-between gap-1.5 rounded-2xl px-4 py-2.5 text-center text-xs text-slate-500 glass-panel dark:text-slate-400 sm:flex-row sm:text-left">
        <span>© {year} SAIRO. All rights reserved.</span>
        <span>
          Built by{' '}
          <a
            href="https://sites.google.com/view/thevisarggalaxy/"
            target="_blank"
            rel="noopener noreferrer"
            className="font-semibold text-sage-600 underline-offset-4 transition-colors hover:text-sage-500 hover:underline dark:text-sage-300 dark:hover:text-cyan-300"
          >
            theVisargGalaxy
          </a>
          , Indore
        </span>
      </div>
    </footer>
  );
}
