export function AIDisclosureBadge() {
  return (
    <div
      className="flex items-start gap-3 bg-govuk-light-grey border-l-4 border-govuk-mid-grey px-4 py-3 mb-6"
      role="note"
      aria-label="AI content disclosure"
    >
      <span className="font-bold text-[19px] text-govuk-black" aria-hidden="true">!</span>
      <p className="text-[16px] text-govuk-black m-0">
        Summaries in this issue are AI-assisted.
      </p>
    </div>
  )
}
