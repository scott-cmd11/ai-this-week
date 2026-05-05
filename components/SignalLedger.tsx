interface SignalLedgerItem {
  label: string
  value: string
}

export function SignalLedger({ items }: { items: SignalLedgerItem[] }) {
  return (
    <dl className="grid border-y border-ws-border sm:grid-cols-3">
      {items.map((item, index) => (
        <div
          key={`${item.label}-${item.value}`}
          className={[
            'py-3',
            index > 0 ? 'border-t border-ws-border sm:border-l sm:border-t-0 sm:px-4' : '',
            index === 0 ? 'sm:pr-4' : '',
          ].join(' ')}
        >
          <dt className="type-meta text-ws-accent">{item.label}</dt>
          <dd className="mt-1 text-[14px] font-semibold leading-snug text-ws-black">
            {item.value}
          </dd>
        </div>
      ))}
    </dl>
  )
}
