// Shared by the home page (a server component) and the dashboard's booth bar (a client one), so
// it stays free of hooks and client-only imports.
export function CreditRollWordmark({ className = '' }: { className?: string }) {
  return (
    <span className={`flex items-center gap-2 ${className}`}>
      <span className="font-display text-[21px] italic leading-none tracking-tight text-cr-bone">CreditRoll</span>
      <span className="cr-label flex items-center gap-1 rounded-[2px] border border-cr-splice/60 px-1.5 py-[3px] text-[8.5px] leading-none text-cr-splice">
        <span aria-hidden className="size-1.5 rounded-full bg-cr-grease shadow-[0_0_6px_var(--cr-grease)]" />
        Live
      </span>
    </span>
  );
}
