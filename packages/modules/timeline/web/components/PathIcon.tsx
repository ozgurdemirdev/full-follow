/** Line icon from a board path (24 unit grid, rounded caps) */
export function PathIcon({ d, className = "size-icon-md", stroke = 1.8 }: { d: string; className?: string; stroke?: number }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={d} />
    </svg>
  );
}
