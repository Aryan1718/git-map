function Footer() {
  return (
    <footer className="relative z-10 border-t border-white/8 px-6 py-8 md:px-10">
      <div className="mx-auto flex max-w-6xl flex-col gap-4 text-sm text-slate-400 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="font-semibold uppercase tracking-[0.35em] text-slate-300">git-map</p>
          <p className="mt-1">Interactive knowledge graphs for repositories, built from structural code parsing.</p>
        </div>
        <a
          href="https://github.com/your-org/git-map"
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-2 text-slate-300 transition hover:text-white"
        >
          GitHub
          <span aria-hidden="true">↗</span>
        </a>
      </div>
    </footer>
  );
}

export default Footer;
