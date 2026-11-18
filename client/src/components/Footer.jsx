export default function Footer({ compact = false }) {
  const year = new Date().getFullYear();

  return (
    <footer
      className={`w-full shrink-0 px-2.5 safe-bottom sm:px-5 md:px-6 ${
        compact ? 'pt-1' : 'pt-2'
      }`}
    >
      <div
        className={`mx-auto flex max-w-5xl flex-col items-center justify-between gap-1 rounded-2xl text-center text-[11px] text-slate-500 glass-panel dark:text-[#8fa5ad] sm:flex-row sm:text-left sm:text-xs ${
          compact ? 'px-3 py-2 sm:px-4' : 'px-4 py-2.5'
        }`}
      >
        <span>© {year} SAIRO. All rights reserved.</span>
        <span>
          Built by{' '}
          <a
            href="https://sites.google.com/view/thevisarggalaxy/"
            target="_blank"
            rel="noopener noreferrer"
            className="font-semibold text-teal-700 underline-offset-4 transition-colors hover:text-teal-600 hover:underline dark:text-teal-300 dark:hover:text-cyan-200"
          >
            theVisargGalaxy
          </a>
          , Indore
        </span>
      </div>
    </footer>
  );
}
