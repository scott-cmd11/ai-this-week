'use client'

import { useState } from 'react'
import { BriefingImport } from './_briefing-import'
import { CaptureSettings } from './_capture-settings'

type SecondaryTab = 'source-tools' | 'future-queue' | 'health' | 'settings'

const TABS: Array<{ key: SecondaryTab; label: string }> = [
  { key: 'source-tools', label: 'Source Tools' },
  { key: 'future-queue', label: 'Future Queue' },
  { key: 'health', label: 'Health' },
  { key: 'settings', label: 'Settings' },
]

export function SecondaryAdminTabs({ password }: { password: string }) {
  const [activeTab, setActiveTab] = useState<SecondaryTab>('source-tools')

  return (
    <section className="admin-panel overflow-hidden bg-ws-white">
      <header className="border-b border-ws-border p-5 sm:p-6">
        <p className="admin-eyebrow">Source and utility tools</p>
        <div className="mt-2 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h2 className="admin-page-title">
              Tools
            </h2>
            <p className="admin-copy mt-3 max-w-3xl">
              Retry source intake, review follow-up queues, check health notes, and adjust capture settings without cluttering the normal publishing path.
            </p>
          </div>
        </div>
      </header>

      <div className="overflow-x-auto border-b border-ws-border bg-ws-page/70 p-2" aria-label="Secondary admin areas">
        <div className="grid grid-cols-4 gap-1" style={{ minWidth: '32rem' }}>
          {TABS.map(tab => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key)}
              className={`whitespace-nowrap px-3 py-2.5 text-center text-[12px] font-black uppercase tracking-[0.08em] transition-colors ${
                activeTab === tab.key ? 'bg-ws-accent text-white' : 'bg-transparent text-ws-black/65 hover:bg-ws-white hover:text-ws-black'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-5 p-5 sm:p-6">
        {activeTab === 'source-tools' && (
          <BriefingImport password={password} />
        )}

        {activeTab === 'future-queue' && (
          <SecondaryNote
            title="Future Queue"
            eyebrow="Follow-up board"
            body="Held candidates are managed in Candidate Triage under the Held view. This panel is intentionally read-only today: use it as the reminder that future planning starts by holding a candidate, then returning to Choose when it is ready for a draft."
            actions={[
              'Open Guided mode, then Choose, to review Held candidates.',
              'Use Issue Desk when an item already belongs in a specific draft or published issue.',
              'Keep this area read-only until held volume justifies a dedicated scheduling board.',
            ]}
          />
        )}

        {activeTab === 'health' && (
          <SecondaryNote
            title="Health"
            eyebrow="Diagnostics"
            body="Health is centred on the daily preflight, Today's Run Status, and publish readiness. Use it before publishing and after deploy to catch stale sources, low candidate volume, and missing scheduled workflows."
            actions={[
              'Run npm run preflight:publishing before publishing or after deploy when you need a full read-only health check.',
              "Use Today's Run Status for source count, candidate inbox, draft state, blockers, warnings, and preflight state.",
              'Use Publish readiness for the final blocker and warning list before any manual publish.',
              'If source-specific failures become frequent, move them into a read-only diagnostics board here.',
            ]}
          />
        )}

        {activeTab === 'settings' && (
          <CaptureSettings />
        )}
      </div>
    </section>
  )
}

function SecondaryNote({
  title,
  eyebrow,
  body,
  actions = [],
}: {
  title: string
  eyebrow: string
  body: string
  actions?: string[]
}) {
  return (
    <div className="admin-subpanel p-5">
      <p className="admin-eyebrow">{eyebrow}</p>
      <h3 className="admin-page-title mt-2">
        {title}
      </h3>
      <p className="admin-copy mt-3 max-w-3xl">{body}</p>
      {actions.length > 0 && (
        <ul className="mt-5 grid gap-2 border-y border-ws-border py-3">
          {actions.map(action => (
            <li key={action} className="grid grid-cols-[1.5rem_minmax(0,1fr)] gap-2 text-[13px] font-bold leading-snug text-ws-black/70">
              <span className="type-meta text-ws-accent">-</span>
              <span>{action}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
