export function AIDisclosureBadge() {
  return (
    <div
      className="inline-flex items-center gap-2 border-[3px] border-neopop-black bg-neopop-yellow px-3 py-2 mb-6 shadow-[4px_4px_0_0_var(--color-neopop-black)]"
      role="note"
      aria-label="AI content disclosure"
    >
      <span className="font-black text-[15px] uppercase tracking-wide" aria-hidden="true">!</span>
      <p className="text-[14px] font-bold m-0">
        Summaries in this issue are AI-assisted.
      </p>
    </div>
  )
}
