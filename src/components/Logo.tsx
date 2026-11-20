export function Logo({ className = '', inverted = false }: { className?: string; inverted?: boolean }) {
  return (
    <span className={`flex items-center gap-2 ${className}`}>
      <span className="grid size-7 place-items-center rounded-lg bg-brand-600 text-white shadow-sm">
        <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M4 10V7a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v3" />
          <path d="M3 10h18v5a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-5Z" />
          <path d="M6 17v2M18 17v2" />
        </svg>
      </span>
      <span className={`text-sm font-semibold tracking-tight ${inverted ? 'text-white' : 'text-zinc-900'}`}>
        Dispatch <span className={`font-normal ${inverted ? 'text-zinc-500' : 'text-zinc-400'}`}>Tracker</span>
      </span>
    </span>
  );
}
