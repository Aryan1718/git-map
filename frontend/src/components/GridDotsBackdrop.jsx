function GridDotsBackdrop() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(99,102,241,0.16),transparent_28%),radial-gradient(circle_at_75%_20%,rgba(56,189,248,0.12),transparent_24%),linear-gradient(180deg,#080b12_0%,#0b1020_42%,#070910_100%)]" />

      <svg
        className="absolute inset-0 h-full w-full opacity-[0.22]"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        <defs>
          <pattern id="git-map-grid" width="72" height="72" patternUnits="userSpaceOnUse">
            <path d="M 72 0 L 0 0 0 72" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="1" />
            <circle cx="0" cy="0" r="1.5" fill="rgba(255,255,255,0.18)" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#git-map-grid)" />
      </svg>

      <div className="absolute inset-x-[10%] top-[18%] h-48 rounded-full bg-indigo-500/12 blur-3xl" />
      <div className="absolute right-[12%] top-[12%] h-40 w-40 rounded-full bg-cyan-400/10 blur-3xl" />
      <div className="absolute left-1/2 top-[58%] h-64 w-[62%] -translate-x-1/2 rounded-full bg-slate-900/30 blur-3xl" />

      <div className="absolute inset-x-0 bottom-0 h-52 bg-gradient-to-b from-transparent to-[#070910]" />
    </div>
  );
}

export default GridDotsBackdrop;
