import type { Metadata } from 'next'
import { getPublishedIssues } from '@/lib/issue-store'
import { IssueSearch } from '@/components/IssueSearch'

export const revalidate = 300

export const metadata: Metadata = {
  title: 'Issue Archive',
  description: 'Browse the AI Today issue archive.',
  alternates: {
    canonical: '/issues',
  },
}

export default async function IssuesPage() {
  const issues = await getPublishedIssues()
  const latest = issues[0]

  return (
    <>
      <p className="type-kicker mb-5">Issue archive</p>
      <div className="grid gap-6 border-t border-ws-black pt-6 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-start">
        <div>
          <h1 className="type-page-title mb-4">
            Previous briefings
          </h1>
          <p className="type-lede max-w-3xl">
            A chronological record of published editions. Each issue is source-linked and written for quick professional reading.
          </p>
        </div>

        <aside className="border-y border-ws-border py-4" aria-label="Archive file">
          <p className="type-meta text-ws-accent">Archive file</p>
          <dl className="mt-4 grid gap-0 divide-y divide-ws-border border-y border-ws-border">
            <div className="py-3">
              <dt className="type-meta text-ws-muted">Published issues</dt>
              <dd className="mt-1 font-[family-name:var(--font-display)] text-[2rem] font-semibold leading-none text-ws-black">
                {issues.length}
              </dd>
            </div>
            <div className="py-3">
              <dt className="type-meta text-ws-muted">Latest file</dt>
              <dd className="mt-1 text-[15px] font-semibold leading-snug text-ws-black">
                {latest ? `Issue ${latest.issueNumber}` : 'No issue yet'}
              </dd>
            </div>
            <div className="py-3">
              <dt className="type-meta text-ws-muted">Standard</dt>
              <dd className="mt-1 text-[15px] font-semibold leading-snug text-ws-black">
                Source-linked, Canada-first archive.
              </dd>
            </div>
          </dl>
        </aside>
      </div>

      <div className="section-rule my-10" aria-hidden="true" />
      <IssueSearch issues={issues} />
    </>
  )
}
