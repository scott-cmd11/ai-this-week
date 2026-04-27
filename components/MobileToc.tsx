// Mobile-only table of contents.
// Uses a native <details> disclosure so it works without JS, has built-in
// accessibility, and respects user's reduce-motion preferences.
//
// Hidden on xl screens where the sticky desktop TableOfContents takes over.
// Hidden entirely when fewer than 3 sections — small issues don't need it.

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
    <details className="xl:hidden mb-8 border-[2px] border-ws-black bg-ws-white">
      <summary className="cursor-pointer list-none flex items-center justify-between gap-3 px-4 py-3 font-black uppercase tracking-[0.12em] text-[13px] text-ws-black hover:bg-ws-page select-none">
        <span>
          Contents{' '}
          <span className="text-ws-muted font-normal normal-case tracking-normal text-[12px] ml-1">
            ({entries.length} sections)
          </span>
        </span>
        <span aria-hidden="true" className="text-[14px] font-black text-ws-accent">▾</span>
      </summary>
      <ol className="list-none p-0 m-0 border-t-[2px] border-ws-black/15">
        {entries.map(({ id, label }) => (
          <li key={id} className="border-b border-ws-black/10 last:border-b-0">
            <a
              href={`#${id}`}
              className="block px-4 py-3 text-[15px] leading-[1.4] no-underline text-ws-black hover:bg-ws-accent-light hover:text-ws-accent active:bg-ws-accent active:text-ws-white"
            >
              {label}
            </a>
          </li>
        ))}
      </ol>
    </details>
  )
}
