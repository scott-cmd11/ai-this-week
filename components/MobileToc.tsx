interface TocEntry {
  id: string
  label: string
}

interface Props {
  entries: TocEntry[]
}

export function MobileToc({ entries }: Props) {
  if (entries.length < 3) return null

  return (
    <details className="premium-shell mb-8 overflow-hidden rounded-[1rem] xl:hidden">
      <summary className="type-button flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3.5 text-ws-black select-none hover:bg-white/45">
        <span>
          Contents{' '}
          <span className="type-body ml-1 text-[12px]">
            ({entries.length} sections)
          </span>
        </span>
        <span aria-hidden="true" className="text-[14px] font-semibold text-ws-accent">v</span>
      </summary>
      <ol className="m-0 list-none border-t border-ws-border p-1">
        {entries.map(({ id, label }) => (
          <li key={id}>
            <a
              href={`#${id}`}
              className="block rounded-[0.75rem] px-3 py-2.5 text-[15px] leading-[1.4] text-ws-black no-underline hover:bg-ws-accent-light hover:text-ws-accent active:bg-ws-accent active:text-ws-white"
            >
              {label}
            </a>
          </li>
        ))}
      </ol>
    </details>
  )
}
