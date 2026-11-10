/** Wordmark: a single geometric mark plus the name set in the display face. */
export function Logo({ className = '' }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      <svg viewBox="0 0 64 64" className="size-7" aria-hidden>
        <rect width="64" height="64" rx="16" fill="currentColor" className="text-text" />
        <path d="M22 18h22v7H30v6h12v7H30v8h-8z" className="fill-bg" />
      </svg>
      <span translate="no" className="text-[1.0625rem] font-semibold tracking-[-0.02em]">
        Finnhub
      </span>
    </span>
  );
}
