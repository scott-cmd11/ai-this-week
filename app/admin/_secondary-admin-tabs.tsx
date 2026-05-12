'use client'

import { useState } from 'react'
import { AddToIssue } from './_add-to-issue'
import { BriefingImport } from './_briefing-import'
import { CaptureSettings } from './_capture-settings'
import { PublishedIssueEditor } from './_published-issue-editor'

type SecondaryTab = 'issue-desk' | 'future-queue' | 'health' | 'settings'

const TABS: Array<{ key: SecondaryTab; label: string }> = [
  { key: 'issue-desk', label: 'Issue Desk' },
  { key: 'future-queue', label: 'Future Queue' },
  { key: 'health', label: 'Health' },
  { key: 'settings', label: 'Settings' },
]

export function SecondaryAdminTabs({ password }: { password: string }) {
  const [activeTab, setActiveTab] = useState<SecondaryTab>('issue-desk')
  const [legacyImportOpen, setLegacyImportOpen] = useState(false)

  return (
    <section className="admin-panel overflow-hidden bg-ws-white">
      <header className="border-b border-ws-border p-5 sm:p-6">
        <p className="admin-eyebrow">Secondary areas</p>
        <div className="mt-2 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h2 className="admin-page-title">
              Full desk
            </h2>
            <p className="admin-copy mt-3 max-w-3xl">
              Work outside today&apos;s guided publishing run: append to issues, review follow-up queues, check health notes,
              and adjust capture settings without disturbing the daily path.
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
        {activeTab === 'issue-desk' && (
          <>
            <AddToIssue password={password} />
            <PublishedIssueEditor password={password} />
          </>
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
            body="Health is currently centred on Today's Run Status and publish readiness. Treat this tab as the operating note for where diagnostics live before adding source-specific dashboards."
            actions={[
              "Use Today's Run Status for source count, candidate inbox, draft state, blockers, and warnings.",
              'Use Publish readiness for the final blocker and warning list before any manual publish.',
              'If source-specific failures become frequent, this is the right home for a read-only diagnostics board.',
            ]}
          />
        )}

        {activeTab === 'settings' && (
          <>
            <CaptureSettings />

            <div className="admin-subpanel">
              <button
                type="button"
                onClick={() => setLegacyImportOpen(open => !open)}
                aria-expanded={legacyImportOpen}
                className="flex w-full items-center justify-between gap-3 px-5 py-4 text-left hover:bg-ws-white"
              >
                <div>
                  <p className="admin-eyebrow">Legacy import</p>
                  <p className="mt-1 text-[15px] font-bold text-ws-black">Briefing import fallback</p>
                </div>
                <span className="shrink-0 text-[12px] font-black uppercase tracking-[0.08em] text-ws-black/60">
                  {legacyImportOpen ? 'Hide' : 'Show'}
                </span>
              </button>

              {legacyImportOpen && (
                <div className="border-t border-ws-border p-5">
                  <BriefingImport password={password} />
                </div>
              )}
            </div>
          </>
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
