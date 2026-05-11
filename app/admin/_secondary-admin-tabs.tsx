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
      <header className="border-b border-ws-border p-4 sm:p-5">
        <p className="text-[12px] font-black uppercase tracking-[0.16em] text-ws-black/55">Secondary areas</p>
        <div className="mt-2 flex flex-col gap-2 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h2 className="font-[family-name:var(--font-display)] text-[34px] font-black leading-none tracking-tight sm:text-[40px]">
              Full desk
            </h2>
            <p className="mt-2 max-w-3xl text-[15px] leading-[1.55] text-ws-black/65">
              Work outside today&apos;s guided publishing run: append to issues, review follow-up queues, check health notes,
              and adjust capture settings without disturbing the daily path.
            </p>
          </div>
        </div>
      </header>

      <div className="overflow-x-auto border-b border-ws-border bg-ws-page/70 p-1.5" aria-label="Secondary admin areas">
        <div className="flex min-w-max gap-1">
          {TABS.map(tab => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key)}
              className={`rounded-[0.55rem] px-4 py-2.5 text-left text-[12px] font-black uppercase tracking-[0.08em] transition-colors ${
                activeTab === tab.key ? 'bg-ws-accent text-white' : 'bg-transparent text-ws-black/65 hover:bg-ws-white hover:text-ws-black'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-4 p-4 sm:p-5">
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
            body="Held candidates live under Candidate Triage -> Held for this milestone. A dedicated future-issue board is a follow-up once the held queue has enough volume to need its own workflow."
          />
        )}

        {activeTab === 'health' && (
          <SecondaryNote
            title="Health"
            eyebrow="Diagnostics"
            body="Health starts with Today's Run Status in the guided desk. Source-specific diagnostics are a follow-up so the daily publishing view stays focused on blockers and readiness."
          />
        )}

        {activeTab === 'settings' && (
          <>
            <CaptureSettings />

            <div className="rounded-[0.75rem] border border-dashed border-ws-border bg-ws-page">
              <button
                type="button"
                onClick={() => setLegacyImportOpen(open => !open)}
                aria-expanded={legacyImportOpen}
                className="flex w-full items-center justify-between gap-3 px-5 py-4 text-left hover:bg-ws-white"
              >
                <div>
                  <p className="text-[12px] font-black uppercase tracking-[0.14em] text-ws-black/55">Legacy import</p>
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
}: {
  title: string
  eyebrow: string
  body: string
}) {
  return (
    <div className="rounded-[0.75rem] border border-dashed border-ws-border bg-ws-page p-5">
      <p className="text-[12px] font-black uppercase tracking-[0.14em] text-ws-black/55">{eyebrow}</p>
      <h3 className="mt-2 font-[family-name:var(--font-display)] text-[34px] font-black leading-none tracking-tight">
        {title}
      </h3>
      <p className="mt-3 max-w-3xl text-[15px] leading-[1.55] text-ws-black/65">{body}</p>
    </div>
  )
}
