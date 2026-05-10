# Admin Guided Daily Run Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the AI Today admin around a guided daily publishing run: Today's Run Status -> Intake -> Choose -> Edit -> Check -> Publish.

**Architecture:** Add a small admin domain layer that calculates readiness/check state from Supabase-backed issues and candidates, then build focused client components around that state. Keep current APIs and storage helpers where possible, but replace the main admin composition with a new shell that makes the daily path primary and moves secondary tools behind clear tabs.

**Tech Stack:** Next.js App Router, React client components, TypeScript, Supabase REST via existing helpers, Vitest, Playwright/browser smoke checks.

---

## Scope Check

The approved design includes the daily publishing path plus secondary Issue Desk, Future Queue, Health, and Settings. This plan implements the first shippable admin rebuild:

- Today's Run Status
- Guided Daily Run shell
- Keep/Reject/Hold candidate triage
- Split-view draft editor MVP
- Check + Publish readiness gate
- Secondary area navigation shells that route existing tools into clearer places

Do not fully rebuild Issue Desk or Future Queue in this plan. Keep existing `AddToIssue`, `PublishedIssueEditor`, `CaptureSettings`, and legacy fallback components available under secondary tabs. Full secondary-area depth should be a follow-up plan after the daily publishing path is working.

## File Structure

Create:

- `lib/admin-readiness.ts`
  - Pure functions for draft state, blocker/warning classification, next action, and section balance.
- `tests/lib/admin-readiness.test.ts`
  - Unit coverage for readiness states, blockers, warnings, and next actions.
- `app/api/admin/today-status/route.ts`
  - Protected API returning the admin home/status payload.
- `app/admin/_daily-run-shell.tsx`
  - Top-level client shell for Today status, guided step mode, full desk mode, and secondary tabs.
- `app/admin/_today-run-status.tsx`
  - Home/status screen.
- `app/admin/_candidate-triage.tsx`
  - Keep/Reject/Hold candidate review using existing candidate APIs and import endpoint.
- `app/admin/_draft-split-editor.tsx`
  - Structured draft editor plus public-style preview MVP.
- `app/admin/_publish-checks.tsx`
  - Blocker/warning review and publish controls.
- `app/admin/_secondary-admin-tabs.tsx`
  - Issue Desk, Future Queue, Health, Settings shells that reuse existing components.

Modify:

- `app/admin/page.tsx`
  - Replace current wizard/all-panels composition with `DailyRunShell`.
- `app/admin/_constants.ts`
  - Replace current six-step labels with five daily-run steps if still needed by the shell.
- `app/api/article-candidates/[id]/route.ts`
  - Ensure `status: 'shortlisted'` is treated as Hold and remains visible in Future Queue shell.
- `app/api/import-briefing-articles/route.ts`
  - No behavioural change unless needed; `CandidateTriage` will call it for Keep.
- `tasks/todo.md`
  - Track the implementation pass and verification summary.

Reuse:

- `app/admin/_add-to-issue.tsx`
- `app/admin/_published-issue-editor.tsx`
- `app/admin/_capture-settings.tsx`
- `app/admin/_briefing-import.tsx`
- `app/admin/_research-import.tsx`
- `app/admin/_add-event.tsx`
- `app/admin/_add-article-manually.tsx`
- `app/admin/_today-draft.tsx` as reference while replacing its main role.

---

### Task 1: Add Admin Readiness Domain Logic

**Files:**
- Create: `lib/admin-readiness.ts`
- Create: `tests/lib/admin-readiness.test.ts`

- [ ] **Step 1: Write failing readiness tests**

Create `tests/lib/admin-readiness.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import {
  buildAdminReadiness,
  type AdminCandidateSummary,
  type AdminDraftSummary,
} from '@/lib/admin-readiness'

function candidates(overrides: Partial<AdminCandidateSummary> = {}): AdminCandidateSummary {
  return {
    totalActive: 12,
    topPicks: 5,
    held: 2,
    rejected: 3,
    imported: 4,
    ...overrides,
  }
}

function draft(overrides: Partial<AdminDraftSummary> = {}): AdminDraftSummary {
  return {
    exists: true,
    published: false,
    issueId: 'issue-2026-05-09',
    issueNumber: 9,
    issueDate: '2026-05-09',
    articleCount: 8,
    sections: ['Canada', 'Policy & Regulation', 'Industry & Models'],
    missingSummaryCount: 0,
    missingTitleCount: 0,
    exactDuplicateUrlCount: 0,
    similarTopicCount: 1,
    staleSourceCount: 1,
    weakTitleCount: 0,
    missingImageCount: 2,
    brokenRequiredUrlCount: 0,
    publishReadinessFailed: false,
    ...overrides,
  }
}

describe('buildAdminReadiness', () => {
  it('starts with candidate review when no draft exists and candidates are waiting', () => {
    const result = buildAdminReadiness({
      issueDate: '2026-05-09',
      automation: { lastRunAt: '2026-05-09T12:00:00.000Z', sourceCount: 4, failureCount: 0 },
      candidates: candidates({ totalActive: 47 }),
      draft: draft({ exists: false, articleCount: 0 }),
    })

    expect(result.draftState).toBe('not_started')
    expect(result.primaryAction.label).toBe("Start today's issue")
    expect(result.primaryAction.step).toBe('choose')
    expect(result.nextBestAction).toBe("Review 47 candidates from today's automations.")
  })

  it('blocks publishing when the draft has required data problems', () => {
    const result = buildAdminReadiness({
      issueDate: '2026-05-09',
      automation: { lastRunAt: null, sourceCount: 0, failureCount: 1 },
      candidates: candidates({ totalActive: 0 }),
      draft: draft({ missingSummaryCount: 2, exactDuplicateUrlCount: 1 }),
    })

    expect(result.draftState).toBe('in_progress')
    expect(result.blockers.map(item => item.code)).toEqual(['exact_duplicate_url', 'missing_summary'])
    expect(result.primaryAction.label).toBe('Fix blockers first')
    expect(result.primaryAction.step).toBe('check')
  })

  it('marks a draft ready to check when it only has warnings', () => {
    const result = buildAdminReadiness({
      issueDate: '2026-05-09',
      automation: { lastRunAt: '2026-05-09T12:00:00.000Z', sourceCount: 4, failureCount: 0 },
      candidates: candidates({ held: 1 }),
      draft: draft({ similarTopicCount: 2, staleSourceCount: 1 }),
    })

    expect(result.draftState).toBe('ready_to_check')
    expect(result.blockers).toHaveLength(0)
    expect(result.warnings.map(item => item.code)).toContain('similar_topic')
    expect(result.warnings.map(item => item.code)).toContain('held_candidates')
    expect(result.primaryAction.label).toBe('Review checks')
  })

  it('points to the public issue after publication', () => {
    const result = buildAdminReadiness({
      issueDate: '2026-05-09',
      automation: { lastRunAt: '2026-05-09T12:00:00.000Z', sourceCount: 4, failureCount: 0 },
      candidates: candidates({ totalActive: 0 }),
      draft: draft({ published: true, articleCount: 10 }),
    })

    expect(result.draftState).toBe('published')
    expect(result.primaryAction.label).toBe('View published issue')
    expect(result.primaryAction.href).toBe('/issues/2026-05-09')
  })
})
```

- [ ] **Step 2: Run the failing test**

Run:

```powershell
npm run test -- tests/lib/admin-readiness.test.ts
```

Expected: FAIL because `@/lib/admin-readiness` does not exist.

- [ ] **Step 3: Implement readiness logic**

Create `lib/admin-readiness.ts`:

```ts
export type DailyRunStep = 'status' | 'intake' | 'choose' | 'edit' | 'check' | 'publish'

export type DraftState = 'not_started' | 'in_progress' | 'ready_to_check' | 'published'

export interface AdminAutomationSummary {
  lastRunAt: string | null
  sourceCount: number
  failureCount: number
}

export interface AdminCandidateSummary {
  totalActive: number
  topPicks: number
  held: number
  rejected: number
  imported: number
}

export interface AdminDraftSummary {
  exists: boolean
  published: boolean
  issueId: string | null
  issueNumber: number | null
  issueDate: string
  articleCount: number
  sections: string[]
  missingSummaryCount: number
  missingTitleCount: number
  exactDuplicateUrlCount: number
  similarTopicCount: number
  staleSourceCount: number
  weakTitleCount: number
  missingImageCount: number
  brokenRequiredUrlCount: number
  publishReadinessFailed: boolean
}

export interface AdminCheckItem {
  code:
    | 'no_articles'
    | 'exact_duplicate_url'
    | 'missing_title'
    | 'missing_summary'
    | 'broken_required_url'
    | 'publish_readiness_failed'
    | 'similar_topic'
    | 'stale_source'
    | 'weak_title'
    | 'missing_image'
    | 'uneven_sections'
    | 'held_candidates'
    | 'low_article_count'
    | 'automation_failure'
  label: string
  count: number
  severity: 'blocker' | 'warning'
}

export interface AdminReadinessInput {
  issueDate: string
  automation: AdminAutomationSummary
  candidates: AdminCandidateSummary
  draft: AdminDraftSummary
}

export interface AdminReadiness {
  issueDate: string
  draftState: DraftState
  blockers: AdminCheckItem[]
  warnings: AdminCheckItem[]
  nextBestAction: string
  primaryAction: {
    label: string
    step?: DailyRunStep
    href?: string
  }
}

function item(
  code: AdminCheckItem['code'],
  label: string,
  count: number,
  severity: AdminCheckItem['severity'],
): AdminCheckItem | null {
  if (count <= 0) return null
  return { code, label, count, severity }
}

function compact(items: Array<AdminCheckItem | null>): AdminCheckItem[] {
  return items.filter((entry): entry is AdminCheckItem => Boolean(entry))
}

function hasUnevenSections(draft: AdminDraftSummary): boolean {
  return draft.articleCount >= 6 && draft.sections.length <= 2
}

export function buildAdminReadiness(input: AdminReadinessInput): AdminReadiness {
  const { automation, candidates, draft } = input

  const blockers = compact([
    item('no_articles', 'No articles in draft', draft.exists && !draft.published && draft.articleCount === 0 ? 1 : 0, 'blocker'),
    item('exact_duplicate_url', 'Exact duplicate URL', draft.exactDuplicateUrlCount, 'blocker'),
    item('missing_title', 'Missing title', draft.missingTitleCount, 'blocker'),
    item('missing_summary', 'Missing summary', draft.missingSummaryCount, 'blocker'),
    item('broken_required_url', 'Broken required source URL', draft.brokenRequiredUrlCount, 'blocker'),
    item('publish_readiness_failed', 'Publish readiness failed', draft.publishReadinessFailed ? 1 : 0, 'blocker'),
  ])

  const warnings = compact([
    item('similar_topic', 'Similar topic from recent issue', draft.similarTopicCount, 'warning'),
    item('stale_source', 'Older or stale source date', draft.staleSourceCount, 'warning'),
    item('weak_title', 'Weak title', draft.weakTitleCount, 'warning'),
    item('missing_image', 'Missing image', draft.missingImageCount, 'warning'),
    item('uneven_sections', 'Uneven section balance', hasUnevenSections(draft) ? 1 : 0, 'warning'),
    item('held_candidates', 'Held candidates still unresolved', candidates.held, 'warning'),
    item('low_article_count', 'Very low article count', draft.exists && draft.articleCount > 0 && draft.articleCount < 5 ? 1 : 0, 'warning'),
    item('automation_failure', 'Automation source failure', automation.failureCount, 'warning'),
  ])

  if (draft.published) {
    return {
      issueDate: input.issueDate,
      draftState: 'published',
      blockers: [],
      warnings,
      nextBestAction: 'Issue is published. Use Issue Desk for corrections.',
      primaryAction: { label: 'View published issue', href: `/issues/${draft.issueDate}` },
    }
  }

  if (!draft.exists) {
    return {
      issueDate: input.issueDate,
      draftState: 'not_started',
      blockers,
      warnings,
      nextBestAction: candidates.totalActive > 0
        ? `Review ${candidates.totalActive} candidates from today's automations.`
        : 'No draft exists yet. Check automation status before starting.',
      primaryAction: { label: "Start today's issue", step: candidates.totalActive > 0 ? 'choose' : 'intake' },
    }
  }

  if (blockers.length > 0) {
    return {
      issueDate: input.issueDate,
      draftState: 'in_progress',
      blockers,
      warnings,
      nextBestAction: `Fix ${blockers.length} blocker${blockers.length === 1 ? '' : 's'} before publishing.`,
      primaryAction: { label: 'Fix blockers first', step: 'check' },
    }
  }

  return {
    issueDate: input.issueDate,
    draftState: 'ready_to_check',
    blockers,
    warnings,
    nextBestAction: warnings.length > 0
      ? `Draft has ${draft.articleCount} articles. Review ${warnings.length} warning${warnings.length === 1 ? '' : 's'} before publishing.`
      : `Draft has ${draft.articleCount} articles and no blockers.`,
    primaryAction: { label: warnings.length > 0 ? 'Review checks' : 'Publish issue', step: warnings.length > 0 ? 'check' : 'publish' },
  }
}
```

- [ ] **Step 4: Run the readiness tests**

Run:

```powershell
npm run test -- tests/lib/admin-readiness.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit Task 1**

```powershell
git add lib/admin-readiness.ts tests/lib/admin-readiness.test.ts
git commit -m "feat: add admin readiness model"
```

---

### Task 2: Add Today Status API

**Files:**
- Create: `app/api/admin/today-status/route.ts`
- Modify: `lib/article-candidate-store.ts`
- Test: `tests/lib/admin-readiness.test.ts` remains the pure logic guard

- [ ] **Step 1: Add candidate summary helper**

Modify `lib/article-candidate-store.ts` by adding this exported helper after `listArticleCandidates`:

```ts
export async function summarizeArticleCandidates(): Promise<{
  totalActive: number
  topPicks: number
  held: number
  rejected: number
  imported: number
}> {
  const [active, held, rejected, imported] = await Promise.all([
    listArticleCandidates({ statuses: ['new', 'approved'], limit: 150 }),
    listArticleCandidates({ statuses: ['shortlisted'], limit: 150 }),
    listArticleCandidates({ statuses: ['rejected'], limit: 150 }),
    listArticleCandidates({ statuses: ['imported'], limit: 150 }),
  ])

  return {
    totalActive: active.length,
    topPicks: active.filter(candidate => candidate.score >= 75).length,
    held: held.length,
    rejected: rejected.length,
    imported: imported.length,
  }
}
```

- [ ] **Step 2: Create the protected today-status route**

Create `app/api/admin/today-status/route.ts`:

```ts
import { NextRequest, NextResponse } from 'next/server'
import { parseDailyArticles } from '@/lib/draft-articles'
import { buildAdminReadiness } from '@/lib/admin-readiness'
import { issueDateFor } from '@/lib/issue-date'
import { isArticleCandidateStoreConfigured, summarizeArticleCandidates } from '@/lib/article-candidate-store'
import { buildKnownTitleList } from '@/lib/known-urls'
import { findIssueMemoryWarnings } from '@/lib/issue-memory'
import { getIssueByDate, getIssueBlocks } from '@/lib/issue-store'
import { titleQualityWarnings } from '@/lib/title-quality'

export const dynamic = 'force-dynamic'

function authorize(request: NextRequest) {
  const adminPassword = process.env.ADMIN_PASSWORD
  if (!adminPassword) return { ok: false as const, status: 500, error: 'Server configuration error.' }
  const password = request.headers.get('x-admin-password')
  if (!password || password !== adminPassword) return { ok: false as const, status: 401, error: 'Incorrect password.' }
  return { ok: true as const }
}

export async function GET(request: NextRequest) {
  const auth = authorize(request)
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const today = request.nextUrl.searchParams.get('date') ?? issueDateFor()
  const draft = await getIssueByDate(today, false)
  const blocks = draft ? await getIssueBlocks(draft.id) : []
  const articles = parseDailyArticles(blocks)
  const knownTitles = draft
    ? (await buildKnownTitleList(90)).filter(entry => entry.pageId !== draft.id)
    : await buildKnownTitleList(90)

  const missingTitleCount = articles.filter(article => !article.title?.trim()).length
  const missingSummaryCount = articles.filter(article => !article.annotation?.trim()).length
  const missingImageCount = articles.filter(article => !article.imageUrl?.trim()).length
  const weakTitleCount = articles.flatMap(article => titleQualityWarnings(article.title)).length
  const similarTopicCount = articles.filter(article =>
    article.title && findIssueMemoryWarnings(article.title, knownTitles).length > 0,
  ).length
  const sections = [...new Set(articles.map(article => article.category).filter((value): value is string => Boolean(value)))]

  const candidates = isArticleCandidateStoreConfigured()
    ? await summarizeArticleCandidates()
    : { totalActive: 0, topPicks: 0, held: 0, rejected: 0, imported: 0 }

  const automation = {
    lastRunAt: null,
    sourceCount: 0,
    failureCount: isArticleCandidateStoreConfigured() ? 0 : 1,
  }

  const draftSummary = {
    exists: !!draft,
    published: !!draft?.published,
    issueId: draft?.id ?? null,
    issueNumber: draft?.issueNumber ?? null,
    issueDate: draft?.issueDate ?? today,
    articleCount: articles.length,
    sections,
    missingSummaryCount,
    missingTitleCount,
    exactDuplicateUrlCount: 0,
    similarTopicCount,
    staleSourceCount: 0,
    weakTitleCount,
    missingImageCount,
    brokenRequiredUrlCount: 0,
    publishReadinessFailed: false,
  }

  const readiness = buildAdminReadiness({
    issueDate: today,
    automation,
    candidates,
    draft: draftSummary,
  })

  return NextResponse.json({
    issueDate: today,
    automation,
    candidates,
    draft: draftSummary,
    readiness,
  })
}
```

- [ ] **Step 3: Run lint after the API addition**

Run:

```powershell
npm run lint
```

Expected: PASS. If TypeScript complains about imports or unused values, fix the named import or remove the unused value in the route.

- [ ] **Step 4: Smoke check the protected route locally**

Run a local dev server if one is not running:

```powershell
npm run dev -- -p 3034
```

Then in another terminal:

```powershell
$password = (Get-Content .env.local | Where-Object { $_ -match '^ADMIN_PASSWORD=' } | ForEach-Object { ($_ -split '=',2)[1].Trim().Trim('"').Trim("'") })
Invoke-RestMethod -Uri 'http://localhost:3034/api/admin/today-status' -Headers @{ 'x-admin-password' = $password }
```

Expected: JSON includes `issueDate`, `automation`, `candidates`, `draft`, and `readiness`.

- [ ] **Step 5: Commit Task 2**

```powershell
git add lib/article-candidate-store.ts app/api/admin/today-status/route.ts
git commit -m "feat: add admin today status api"
```

---

### Task 3: Replace Admin Page With Daily Run Shell

**Files:**
- Create: `app/admin/_daily-run-shell.tsx`
- Create: `app/admin/_today-run-status.tsx`
- Modify: `app/admin/page.tsx`

- [ ] **Step 1: Create the TodayRunStatus component**

Create `app/admin/_today-run-status.tsx`:

```tsx
'use client'

import type { AdminReadiness } from '@/lib/admin-readiness'

interface TodayStatusPayload {
  issueDate: string
  automation: { lastRunAt: string | null; sourceCount: number; failureCount: number }
  candidates: { totalActive: number; topPicks: number; held: number; rejected: number; imported: number }
  draft: {
    exists: boolean
    published: boolean
    issueId: string | null
    issueNumber: number | null
    issueDate: string
    articleCount: number
    sections: string[]
    missingSummaryCount: number
  }
  readiness: AdminReadiness
}

export function TodayRunStatus({
  status,
  onPrimaryAction,
}: {
  status: TodayStatusPayload
  onPrimaryAction: () => void
}) {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  })
  const displayDate = formatter.format(new Date(`${status.issueDate}T12:00:00`))

  return (
    <section className="border-[3px] border-ws-black bg-ws-white p-5 shadow-[4px_4px_0_0_var(--color-ws-black)]">
      <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_auto] md:items-start">
        <div>
          <p className="text-[13px] font-black uppercase tracking-[0.15em] text-ws-black/70">Today&apos;s run status</p>
          <h1 className="mt-2 font-[family-name:var(--font-display)] text-[44px] font-black leading-[0.95] tracking-tight">
            {displayDate}
          </h1>
          <p className="mt-3 max-w-2xl text-[15px] leading-[1.55] text-ws-black/65">
            {status.readiness.nextBestAction}
          </p>
        </div>

        <button
          type="button"
          onClick={onPrimaryAction}
          className="bg-ws-accent px-5 py-3 text-[14px] font-black uppercase tracking-[0.08em] text-white hover:bg-ws-accent-hover"
        >
          {status.readiness.primaryAction.label}
        </button>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatusCard
          label="Automations"
          value={status.automation.lastRunAt ? 'Ran' : 'Needs check'}
          detail={`${status.automation.sourceCount} sources / ${status.automation.failureCount} failures`}
        />
        <StatusCard
          label="Candidates"
          value={String(status.candidates.totalActive)}
          detail={`${status.candidates.topPicks} top picks / ${status.candidates.held} held`}
        />
        <StatusCard
          label="Draft"
          value={status.draft.exists ? `${status.draft.articleCount} articles` : 'Not started'}
          detail={status.draft.exists ? `${status.draft.sections.length} sections represented` : 'No draft for today yet'}
        />
        <StatusCard
          label="Checks"
          value={`${status.readiness.blockers.length} blockers`}
          detail={`${status.readiness.warnings.length} warnings`}
          accent={status.readiness.blockers.length > 0}
        />
      </div>
    </section>
  )
}

function StatusCard({
  label,
  value,
  detail,
  accent = false,
}: {
  label: string
  value: string
  detail: string
  accent?: boolean
}) {
  return (
    <div className={`border-[2px] px-4 py-3 ${accent ? 'border-ws-accent bg-ws-accent-light/30' : 'border-ws-black bg-ws-page'}`}>
      <p className="text-[11px] font-black uppercase tracking-[0.12em] text-ws-black/55">{label}</p>
      <p className="mt-2 text-[24px] font-black leading-none">{value}</p>
      <p className="mt-2 text-[12px] text-ws-black/60">{detail}</p>
    </div>
  )
}
```

- [ ] **Step 2: Create the DailyRunShell component**

Create `app/admin/_daily-run-shell.tsx`:

```tsx
'use client'

import { useEffect, useState } from 'react'
import type { DailyRunStep } from '@/lib/admin-readiness'
import { TodayRunStatus } from './_today-run-status'
import { CandidateTriage } from './_candidate-triage'
import { DraftSplitEditor } from './_draft-split-editor'
import { PublishChecks } from './_publish-checks'
import { SecondaryAdminTabs } from './_secondary-admin-tabs'

type AdminMode = 'guided' | 'full'

const STEPS: Array<{ key: DailyRunStep; label: string }> = [
  { key: 'status', label: 'Status' },
  { key: 'intake', label: 'Intake' },
  { key: 'choose', label: 'Choose' },
  { key: 'edit', label: 'Edit' },
  { key: 'check', label: 'Check' },
  { key: 'publish', label: 'Publish' },
]

export function DailyRunShell({
  password,
  onSignOut,
}: {
  password: string
  onSignOut: () => void
}) {
  const [mode, setMode] = useState<AdminMode>('guided')
  const [step, setStep] = useState<DailyRunStep>('status')
  const [status, setStatus] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  async function loadStatus() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/admin/today-status', {
        headers: { 'x-admin-password': password },
      })
      const payload = await res.json()
      if (!res.ok) {
        setError(payload.error ?? `Could not load today status (${res.status}).`)
        return
      }
      setStatus(payload)
    } catch {
      setError('Could not load today status.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadStatus()
    const handler = () => loadStatus()
    window.addEventListener('aitoday:refresh-draft', handler)
    return () => window.removeEventListener('aitoday:refresh-draft', handler)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [password])

  function goToPrimaryAction() {
    const nextStep = status?.readiness?.primaryAction?.step as DailyRunStep | undefined
    if (nextStep) setStep(nextStep)
    if (status?.readiness?.primaryAction?.href) window.open(status.readiness.primaryAction.href, '_blank', 'noopener,noreferrer')
  }

  return (
    <div className="admin-workspace flex min-h-screen flex-col gap-5 px-3 py-4 md:px-6">
      <header className="border-[3px] border-ws-black bg-ws-white p-4 shadow-[4px_4px_0_0_var(--color-ws-black)]">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <p className="editorial-label mb-3">Publisher console</p>
            <h1 className="font-[family-name:var(--font-display)] text-[44px] font-black leading-[0.9] tracking-tight">
              Daily Run
            </h1>
            <p className="mt-3 max-w-2xl text-[15px] leading-[1.55] text-ws-muted">
              Publish today&apos;s issue through one guided path. Use the full desk only when you need to jump around.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setMode(mode === 'guided' ? 'full' : 'guided')}
              className="border-[2px] border-ws-black px-3 py-2 text-[12px] font-black uppercase tracking-[0.08em] hover:bg-ws-page"
            >
              {mode === 'guided' ? 'View full desk' : 'Guided mode'}
            </button>
            <button
              type="button"
              onClick={onSignOut}
              className="px-3 py-2 text-[12px] font-black uppercase tracking-[0.08em] underline hover:text-ws-accent"
            >
              Sign out
            </button>
          </div>
        </div>
      </header>

      <nav className="flex gap-2 overflow-x-auto border-b-[3px] border-ws-black pb-2" aria-label="Daily run steps">
        {STEPS.map(item => (
          <button
            key={item.key}
            type="button"
            onClick={() => setStep(item.key)}
            className={`shrink-0 px-3 py-2 text-[12px] font-black uppercase tracking-[0.08em] ${
              step === item.key ? 'bg-ws-black text-ws-white' : 'bg-ws-page text-ws-black hover:bg-ws-white'
            }`}
          >
            {item.label}
          </button>
        ))}
      </nav>

      {loading && <p className="text-[14px] text-ws-black/60">Loading today&apos;s run...</p>}
      {error && <p className="border border-red-300 bg-red-50 px-3 py-2 text-[13px] font-bold text-red-700">{error}</p>}
      {!loading && status && (
        mode === 'full' ? (
          <div className="flex flex-col gap-5">
            <TodayRunStatus status={status} onPrimaryAction={goToPrimaryAction} />
            <CandidateTriage password={password} onChanged={loadStatus} />
            <DraftSplitEditor password={password} />
            <PublishChecks password={password} status={status} onPublished={loadStatus} />
            <SecondaryAdminTabs password={password} />
          </div>
        ) : (
          <>
            {step === 'status' && <TodayRunStatus status={status} onPrimaryAction={goToPrimaryAction} />}
            {step === 'intake' && <TodayRunStatus status={status} onPrimaryAction={() => setStep('choose')} />}
            {step === 'choose' && <CandidateTriage password={password} onChanged={loadStatus} />}
            {step === 'edit' && <DraftSplitEditor password={password} />}
            {step === 'check' && <PublishChecks password={password} status={status} onPublished={loadStatus} />}
            {step === 'publish' && <PublishChecks password={password} status={status} onPublished={loadStatus} forcePublishView />}
          </>
        )
      )}
    </div>
  )
}
```

- [ ] **Step 3: Replace the authed admin render**

Modify `app/admin/page.tsx`:

1. Keep the sign-in/auth logic.
2. Remove imports for old page-level composition that are only used after sign-in.
3. Import `DailyRunShell`.
4. Replace the entire authed render branch with:

```tsx
  return (
    <DailyRunShell
      password={password}
      onSignOut={handleSignOut}
    />
  )
```

The file should still export `AdminPage`, handle sign-in, and store `adminAuth` in `sessionStorage`.

- [ ] **Step 4: Run lint**

Run:

```powershell
npm run lint
```

Expected: PASS after removing unused imports/state from `app/admin/page.tsx`.

- [ ] **Step 5: Commit Task 3**

```powershell
git add app/admin/page.tsx app/admin/_daily-run-shell.tsx app/admin/_today-run-status.tsx
git commit -m "feat: add guided daily run shell"
```

---

### Task 4: Build Keep / Reject / Hold Candidate Triage

**Files:**
- Create: `app/admin/_candidate-triage.tsx`
- Modify: `app/api/article-candidates/[id]/route.ts` only if its PATCH payload does not already accept `status`

- [ ] **Step 1: Create candidate triage component**

Create `app/admin/_candidate-triage.tsx`:

```tsx
'use client'

import { useEffect, useMemo, useState } from 'react'
import { CATEGORY_ORDER, CATEGORY_META, type Category } from '@/lib/category-mapping'
import type { ArticleCandidate, CandidateStatus } from '@/lib/article-candidates'

type Filter = 'top' | 'needs_review' | 'held' | 'rejected' | 'imported'

const FILTERS: Array<{ key: Filter; label: string; status: string }> = [
  { key: 'top', label: 'Top picks', status: 'new,approved' },
  { key: 'needs_review', label: 'Needs review', status: 'new,approved' },
  { key: 'held', label: 'Held', status: 'shortlisted' },
  { key: 'rejected', label: 'Rejected', status: 'rejected' },
  { key: 'imported', label: 'Imported', status: 'imported' },
]

export function CandidateTriage({
  password,
  onChanged,
}: {
  password: string
  onChanged: () => void
}) {
  const [filter, setFilter] = useState<Filter>('top')
  const [candidates, setCandidates] = useState<ArticleCandidate[]>([])
  const [loading, setLoading] = useState(true)
  const [working, setWorking] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  const visibleCandidates = useMemo(() => {
    const list = filter === 'top'
      ? candidates.filter(candidate => candidate.score >= 70)
      : candidates
    return [...list].sort((a, b) => b.score - a.score)
  }, [candidates, filter])

  async function load() {
    setLoading(true)
    setError(null)
    setMessage(null)
    const activeFilter = FILTERS.find(item => item.key === filter) ?? FILTERS[0]
    try {
      const res = await fetch(`/api/article-candidates?status=${encodeURIComponent(activeFilter.status)}&limit=100`, {
        headers: { 'x-admin-password': password },
      })
      const payload = await res.json()
      if (!res.ok) {
        setError(payload.error ?? `Could not load candidates (${res.status}).`)
        return
      }
      setCandidates(payload.candidates ?? [])
    } catch {
      setError('Could not load candidates.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter, password])

  async function patchCandidate(id: string, update: { status?: CandidateStatus; category?: Category }) {
    setWorking(id)
    setError(null)
    setMessage(null)
    try {
      const res = await fetch(`/api/article-candidates/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ adminPassword: password, ...update }),
      })
      const payload = await res.json()
      if (!res.ok) {
        setError(payload.error ?? `Could not update candidate (${res.status}).`)
        return
      }
      setCandidates(prev => prev.map(candidate => candidate.id === id ? payload.candidate : candidate))
      onChanged()
    } catch {
      setError('Could not update candidate.')
    } finally {
      setWorking(null)
    }
  }

  async function keep(candidate: ArticleCandidate) {
    setWorking(candidate.id)
    setError(null)
    setMessage(null)
    try {
      const res = await fetch('/api/import-briefing-articles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          adminPassword: password,
          rewriteWithAi: true,
          articles: [{
            title: candidate.title,
            summary: candidate.summary || candidate.scoreReasons.join(' '),
            url: candidate.url,
            category: candidate.category,
          }],
        }),
      })
      const payload = await res.json()
      if (!res.ok) {
        setError(payload.error ?? `Could not keep candidate (${res.status}).`)
        return
      }
      await patchCandidate(candidate.id, { status: 'imported' })
      setMessage(`Kept "${candidate.title}" and added it to today's draft.`)
      window.dispatchEvent(new CustomEvent('aitoday:refresh-draft'))
      await load()
    } catch {
      setError('Could not keep candidate.')
    } finally {
      setWorking(null)
    }
  }

  return (
    <section className="border-[3px] border-ws-black bg-ws-white p-5 shadow-[4px_4px_0_0_var(--color-ws-black)]">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <p className="text-[13px] font-black uppercase tracking-[0.15em] text-ws-black/70">Choose</p>
          <h2 className="mt-2 font-[family-name:var(--font-display)] text-[34px] font-black leading-[0.95] tracking-tight">
            Candidate triage
          </h2>
          <p className="mt-3 max-w-2xl text-[14px] leading-[1.55] text-ws-black/65">
            Review top picks first. Keep adds to today&apos;s draft, Reject clears it, Hold sends it to the future queue.
          </p>
        </div>
        <button type="button" onClick={load} disabled={loading} className="text-[12px] font-black uppercase tracking-[0.08em] underline">
          {loading ? 'Refreshing...' : 'Refresh'}
        </button>
      </div>

      <div className="mt-5 flex gap-2 overflow-x-auto">
        {FILTERS.map(item => (
          <button
            key={item.key}
            type="button"
            onClick={() => setFilter(item.key)}
            className={`shrink-0 px-3 py-2 text-[12px] font-black uppercase tracking-[0.08em] ${
              filter === item.key ? 'bg-ws-black text-ws-white' : 'bg-ws-page hover:bg-ws-white'
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      {error && <p className="mt-4 border border-red-300 bg-red-50 px-3 py-2 text-[13px] font-bold text-red-700">{error}</p>}
      {message && <p className="mt-4 border border-ws-black/20 bg-ws-page px-3 py-2 text-[13px] font-bold">{message}</p>}
      {loading && <p className="mt-5 text-[14px] text-ws-black/60">Loading candidates...</p>}

      {!loading && visibleCandidates.length === 0 && (
        <p className="mt-5 border border-ws-black/15 bg-ws-page px-3 py-3 text-[13px] text-ws-black/65">
          No candidates in this view.
        </p>
      )}

      <div className="mt-5 flex flex-col divide-y divide-ws-black/10">
        {visibleCandidates.map(candidate => (
          <article key={candidate.id} className="grid gap-3 py-4 lg:grid-cols-[minmax(0,1fr)_220px]">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="border-[2px] border-ws-black px-2 py-0.5 text-[11px] font-black">{candidate.score}</span>
                {candidate.score >= 75 && <span className="text-[11px] font-black uppercase tracking-[0.12em] text-ws-accent">Recommended</span>}
                <span className="text-[11px] font-bold text-ws-black/50">{candidate.source}</span>
              </div>
              <h3 className="mt-2 text-[16px] font-black leading-snug">{candidate.title}</h3>
              {candidate.summary && <p className="mt-1 text-[13px] leading-snug text-ws-black/70">{candidate.summary}</p>}
              <a href={candidate.url} target="_blank" rel="noopener noreferrer" className="mt-2 inline-flex text-[12px] text-ws-black/50 underline">
                Open source
              </a>
              {candidate.scoreReasons.length > 0 && (
                <p className="mt-2 text-[12px] text-ws-black/45">{candidate.scoreReasons.slice(0, 3).join(' / ')}</p>
              )}
            </div>

            <div className="flex flex-col gap-2">
              <select
                value={candidate.category}
                onChange={event => patchCandidate(candidate.id, { category: event.target.value as Category })}
                disabled={working === candidate.id}
                className="border border-ws-black/30 bg-ws-page px-2 py-2 text-[12px] font-bold"
                aria-label={`Section for ${candidate.title}`}
              >
                {CATEGORY_ORDER.map(category => (
                  <option key={category} value={category}>{CATEGORY_META[category].icon} {category}</option>
                ))}
              </select>
              <button type="button" onClick={() => keep(candidate)} disabled={working === candidate.id} className="bg-ws-accent px-3 py-2 text-[12px] font-black uppercase tracking-[0.08em] text-white disabled:opacity-50">
                Keep
              </button>
              <button type="button" onClick={() => patchCandidate(candidate.id, { status: 'rejected' })} disabled={working === candidate.id} className="border border-ws-black/30 px-3 py-2 text-[12px] font-black uppercase tracking-[0.08em] disabled:opacity-50">
                Reject
              </button>
              <button type="button" onClick={() => patchCandidate(candidate.id, { status: 'shortlisted' })} disabled={working === candidate.id} className="border border-ws-black/30 px-3 py-2 text-[12px] font-black uppercase tracking-[0.08em] disabled:opacity-50">
                Hold
              </button>
            </div>
          </article>
        ))}
      </div>
    </section>
  )
}
```

- [ ] **Step 2: Run lint**

Run:

```powershell
npm run lint
```

Expected: PASS.

- [ ] **Step 3: Browser smoke check candidate actions**

Open the admin in the browser and verify:

- Choose step shows `Keep`, `Reject`, and `Hold`.
- Top picks filter appears first.
- A candidate section dropdown is visible.

Do not click `Keep` on production data during this smoke check unless the user explicitly approves mutating the live issue.

- [ ] **Step 4: Commit Task 4**

```powershell
git add app/admin/_candidate-triage.tsx
git commit -m "feat: add candidate triage step"
```

---

### Task 5: Build Draft Split Editor MVP

**Files:**
- Create: `app/admin/_draft-split-editor.tsx`
- Reuse: `app/admin/_add-article-manually.tsx`
- Reuse: `app/admin/_add-event.tsx`
- Reuse API: `app/api/today-draft/route.ts`

- [ ] **Step 1: Create split editor component**

Create `app/admin/_draft-split-editor.tsx`:

```tsx
'use client'

import { useEffect, useMemo, useState } from 'react'
import { CATEGORY_ORDER, CATEGORY_META, type Category } from '@/lib/category-mapping'
import { AddArticleManually } from './_add-article-manually'
import { AddEvent } from './_add-event'

interface DailyArticle {
  title: string | null
  annotation: string | null
  url: string | null
  imageUrl: string | null
  annotationBlockId: string | null
  category: string | null
}

export function DraftSplitEditor({ password }: { password: string }) {
  const [draft, setDraft] = useState<{ id: string; issueNumber: number; issueDate: string; title: string } | null>(null)
  const [articles, setArticles] = useState<DailyArticle[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [mobileTab, setMobileTab] = useState<'edit' | 'preview'>('edit')

  async function loadDraft() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/today-draft', {
        headers: { 'x-admin-password': password },
      })
      const payload = await res.json()
      if (!res.ok) {
        setError(payload.error ?? `Could not load draft (${res.status}).`)
        return
      }
      setDraft(payload.draft ?? null)
      setArticles(payload.articles ?? [])
    } catch {
      setError('Could not load draft.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadDraft()
    const handler = () => loadDraft()
    window.addEventListener('aitoday:refresh-draft', handler)
    return () => window.removeEventListener('aitoday:refresh-draft', handler)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [password])

  const grouped = useMemo(() => {
    const map = new Map<string, DailyArticle[]>()
    for (const article of articles) {
      const category = article.category ?? 'Uncategorized'
      if (!map.has(category)) map.set(category, [])
      map.get(category)!.push(article)
    }
    return [
      ...CATEGORY_ORDER.filter(category => map.has(category)).map(category => [category, map.get(category)!] as const),
      ...[...map.entries()].filter(([category]) => !CATEGORY_ORDER.includes(category as Category)),
    ]
  }, [articles])

  return (
    <section className="border-[3px] border-ws-black bg-ws-white p-5 shadow-[4px_4px_0_0_var(--color-ws-black)]">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <p className="text-[13px] font-black uppercase tracking-[0.15em] text-ws-black/70">Edit</p>
          <h2 className="mt-2 font-[family-name:var(--font-display)] text-[34px] font-black leading-[0.95] tracking-tight">
            Draft editor
          </h2>
          <p className="mt-3 text-[14px] text-ws-black/65">
            Shape the issue on the left. Use the preview to check how it reads.
          </p>
        </div>
        <button type="button" onClick={loadDraft} disabled={loading} className="text-[12px] font-black uppercase tracking-[0.08em] underline">
          {loading ? 'Refreshing...' : 'Refresh'}
        </button>
      </div>

      <div className="mt-5 grid grid-cols-2 border border-ws-black/30 md:hidden">
        <button type="button" onClick={() => setMobileTab('edit')} className={`px-3 py-2 text-[12px] font-black uppercase ${mobileTab === 'edit' ? 'bg-ws-black text-white' : 'bg-ws-page'}`}>
          Edit
        </button>
        <button type="button" onClick={() => setMobileTab('preview')} className={`px-3 py-2 text-[12px] font-black uppercase ${mobileTab === 'preview' ? 'bg-ws-black text-white' : 'bg-ws-page'}`}>
          Preview
        </button>
      </div>

      {error && <p className="mt-4 border border-red-300 bg-red-50 px-3 py-2 text-[13px] font-bold text-red-700">{error}</p>}
      {loading && <p className="mt-5 text-[14px] text-ws-black/60">Loading draft...</p>}
      {!loading && !draft && <p className="mt-5 border border-ws-black/15 bg-ws-page px-3 py-3 text-[13px] text-ws-black/65">No draft exists yet. Keep candidates first.</p>}

      {draft && (
        <div className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(360px,0.8fr)]">
          <div className={mobileTab === 'preview' ? 'hidden md:block' : ''}>
            <div className="flex flex-col gap-4">
              {grouped.map(([category, items]) => (
                <section key={category} className="border border-ws-black/15">
                  <div className="flex items-center justify-between gap-3 bg-ws-page px-3 py-2">
                    <p className="text-[12px] font-black uppercase tracking-[0.1em]">
                      {CATEGORY_META[category as Category]?.icon ? `${CATEGORY_META[category as Category].icon} ` : ''}{category}
                    </p>
                    <p className="text-[11px] text-ws-black/45">{items.length} item{items.length === 1 ? '' : 's'}</p>
                  </div>
                  <div className="divide-y divide-ws-black/10">
                    {items.map((article, index) => (
                      <div key={`${article.url ?? article.title}-${index}`} className="px-3 py-3">
                        <p className="text-[14px] font-black leading-snug">{article.title ?? '(untitled)'}</p>
                        <p className="mt-1 line-clamp-2 text-[13px] text-ws-black/65">{article.annotation ?? '(missing summary)'}</p>
                        {article.url && <a href={article.url} target="_blank" rel="noopener noreferrer" className="mt-2 inline-flex text-[12px] text-ws-black/50 underline">Open source</a>}
                      </div>
                    ))}
                  </div>
                </section>
              ))}
              <AddArticleManually password={password} />
              <AddEvent password={password} />
            </div>
          </div>

          <aside className={mobileTab === 'edit' ? 'hidden md:block' : ''}>
            <div className="sticky top-4 border border-ws-black/20 bg-ws-page p-4">
              <p className="text-[12px] font-black uppercase tracking-[0.12em] text-ws-black/60">Preview</p>
              <h3 className="mt-2 text-[24px] font-black leading-tight">AI Today - {draft.issueDate}</h3>
              <div className="mt-4 flex flex-col gap-4">
                {grouped.map(([category, items]) => (
                  <section key={category}>
                    <h4 className="border-b border-ws-black pb-1 text-[13px] font-black uppercase tracking-[0.1em]">{category}</h4>
                    <div className="mt-2 flex flex-col gap-3">
                      {items.map((article, index) => (
                        <article key={`${article.url ?? article.title}-preview-${index}`}>
                          <p className="text-[14px] font-bold leading-snug">{article.title}</p>
                          <p className="mt-1 text-[13px] leading-snug text-ws-black/65">{article.annotation}</p>
                        </article>
                      ))}
                    </div>
                  </section>
                ))}
              </div>
            </div>
          </aside>
        </div>
      )}
    </section>
  )
}
```

- [ ] **Step 2: Run lint**

Run:

```powershell
npm run lint
```

Expected: PASS.

- [ ] **Step 3: Browser smoke check split editor**

Open `/admin`, sign in, go to Edit.

Verify:

- Desktop shows editor and preview side by side.
- Mobile width shows Edit/Preview tabs.
- Add article and Add learning event are visible inside the editor area.

- [ ] **Step 4: Commit Task 5**

```powershell
git add app/admin/_draft-split-editor.tsx
git commit -m "feat: add draft split editor"
```

---

### Task 6: Build Check + Publish Gate

**Files:**
- Create: `app/admin/_publish-checks.tsx`
- Reuse API: `app/api/publish-issue/route.ts`

- [ ] **Step 1: Create publish checks component**

Create `app/admin/_publish-checks.tsx`:

```tsx
'use client'

import { useState } from 'react'

export function PublishChecks({
  password,
  status,
  onPublished,
  forcePublishView = false,
}: {
  password: string
  status: any
  onPublished: () => void
  forcePublishView?: boolean
}) {
  const [acknowledged, setAcknowledged] = useState(false)
  const [publishing, setPublishing] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const draft = status.draft
  const readiness = status.readiness
  const blockers = readiness.blockers ?? []
  const warnings = readiness.warnings ?? []
  const canPublish = Boolean(draft.issueId) && draft.exists && !draft.published && blockers.length === 0 && (warnings.length === 0 || acknowledged)

  async function publish() {
    if (!canPublish) return
    setPublishing(true)
    setMessage(null)
    setError(null)
    try {
      const res = await fetch('/api/publish-issue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password, pageId: draft.issueId }),
      })
      const payload = await res.json()
      if (!res.ok) {
        setError(payload.error ?? `Could not publish (${res.status}).`)
        return
      }
      setMessage(`Issue #${payload.issueNumber ?? draft.issueNumber} published.`)
      onPublished()
    } catch {
      setError('Could not publish issue.')
    } finally {
      setPublishing(false)
    }
  }

  return (
    <section className="border-[3px] border-ws-black bg-ws-white p-5 shadow-[4px_4px_0_0_var(--color-ws-black)]">
      <div>
        <p className="text-[13px] font-black uppercase tracking-[0.15em] text-ws-black/70">{forcePublishView ? 'Publish' : 'Check'}</p>
        <h2 className="mt-2 font-[family-name:var(--font-display)] text-[34px] font-black leading-[0.95] tracking-tight">
          Publish readiness
        </h2>
        <p className="mt-3 max-w-2xl text-[14px] leading-[1.55] text-ws-black/65">
          Review blockers and warnings before publishing. Blockers must be fixed. Warnings can be acknowledged.
        </p>
      </div>

      {error && <p className="mt-4 border border-red-300 bg-red-50 px-3 py-2 text-[13px] font-bold text-red-700">{error}</p>}
      {message && <p className="mt-4 border border-ws-black/20 bg-ws-page px-3 py-2 text-[13px] font-bold">{message}</p>}

      <div className="mt-5 grid gap-4 md:grid-cols-2">
        <CheckList title="Blockers" empty="No blockers." items={blockers} tone="red" />
        <CheckList title="Warnings" empty="No warnings." items={warnings} tone="amber" />
      </div>

      {warnings.length > 0 && blockers.length === 0 && (
        <label className="mt-5 flex items-start gap-2 text-[13px] text-ws-black/70">
          <input
            type="checkbox"
            checked={acknowledged}
            onChange={event => setAcknowledged(event.target.checked)}
            className="mt-0.5 h-4 w-4 accent-ws-black"
          />
          <span>I reviewed the warnings and still want to publish this issue.</span>
        </label>
      )}

      <button
        type="button"
        onClick={publish}
        disabled={!canPublish || publishing}
        className="mt-5 bg-ws-accent px-5 py-3 text-[13px] font-black uppercase tracking-[0.08em] text-white hover:bg-ws-accent-hover disabled:cursor-not-allowed disabled:opacity-40"
      >
        {publishing
          ? 'Publishing...'
          : blockers.length > 0
            ? 'Fix blockers first'
            : warnings.length > 0 && !acknowledged
              ? 'Acknowledge warnings and publish'
              : 'Publish issue'}
      </button>
    </section>
  )
}

function CheckList({
  title,
  empty,
  items,
  tone,
}: {
  title: string
  empty: string
  items: Array<{ code: string; label: string; count: number }>
  tone: 'red' | 'amber'
}) {
  const border = tone === 'red' ? 'border-red-300 bg-red-50 text-red-800' : 'border-ws-accent bg-ws-accent-light/40 text-ws-black'
  return (
    <div className={`border px-4 py-3 ${items.length > 0 ? border : 'border-ws-black/15 bg-ws-page text-ws-black/65'}`}>
      <p className="text-[12px] font-black uppercase tracking-[0.12em]">{title}</p>
      {items.length === 0 ? (
        <p className="mt-2 text-[13px]">{empty}</p>
      ) : (
        <ul className="mt-2 flex flex-col gap-1.5">
          {items.map(item => (
            <li key={item.code} className="text-[13px]">
              <strong>{item.count}</strong> {item.label}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Confirm publish payload uses issue ID**

Confirm Task 2 includes `draft.issueId` in the today-status payload and confirm the component publishes with:

```tsx
body: JSON.stringify({ password, pageId: draft.issueId }),
```

- [ ] **Step 3: Run lint and build**

Run:

```powershell
npm run lint
npm run build
```

Expected: both PASS.

- [ ] **Step 4: Browser smoke check publish gate**

Open `/admin`, sign in, go to Check.

Verify:

- Blockers and warnings render.
- Publish button is disabled when blockers exist.
- Warning acknowledgement checkbox appears when warnings exist and blockers do not.

Do not publish production unless the user explicitly approves.

- [ ] **Step 5: Commit Task 6**

```powershell
git add app/admin/_publish-checks.tsx app/api/admin/today-status/route.ts
git commit -m "feat: add publish readiness gate"
```

---

### Task 7: Add Secondary Tabs Shell

**Files:**
- Create: `app/admin/_secondary-admin-tabs.tsx`
- Reuse existing secondary components

- [ ] **Step 1: Create secondary tabs component**

Create `app/admin/_secondary-admin-tabs.tsx`:

```tsx
'use client'

import { useState } from 'react'
import { AddToIssue } from './_add-to-issue'
import { PublishedIssueEditor } from './_published-issue-editor'
import { CaptureSettings } from './_capture-settings'
import { BriefingImport } from './_briefing-import'

type Tab = 'issue_desk' | 'future_queue' | 'health' | 'settings'

export function SecondaryAdminTabs({ password }: { password: string }) {
  const [tab, setTab] = useState<Tab>('issue_desk')

  return (
    <section className="border-[3px] border-ws-black bg-ws-white p-5 shadow-[4px_4px_0_0_var(--color-ws-black)]">
      <div>
        <p className="text-[13px] font-black uppercase tracking-[0.15em] text-ws-black/70">Secondary areas</p>
        <h2 className="mt-2 font-[family-name:var(--font-display)] text-[34px] font-black leading-[0.95] tracking-tight">
          Full desk
        </h2>
        <p className="mt-3 max-w-2xl text-[14px] leading-[1.55] text-ws-black/65">
          Use these tools when you need to work outside today&apos;s guided publishing run.
        </p>
      </div>

      <div className="mt-5 flex gap-2 overflow-x-auto">
        {[
          ['issue_desk', 'Issue Desk'],
          ['future_queue', 'Future Queue'],
          ['health', 'Health'],
          ['settings', 'Settings'],
        ].map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key as Tab)}
            className={`shrink-0 px-3 py-2 text-[12px] font-black uppercase tracking-[0.08em] ${
              tab === key ? 'bg-ws-black text-ws-white' : 'bg-ws-page hover:bg-ws-white'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="mt-5">
        {tab === 'issue_desk' && (
          <div className="flex flex-col gap-5">
            <AddToIssue password={password} />
            <PublishedIssueEditor password={password} />
          </div>
        )}
        {tab === 'future_queue' && (
          <div className="border border-ws-black/15 bg-ws-page px-4 py-3">
            <p className="text-[13px] font-bold text-ws-black">Held candidates live under Candidate Triage -> Held for this milestone.</p>
            <p className="mt-1 text-[13px] text-ws-black/60">A dedicated Future Queue board is the next plan after the daily run rebuild.</p>
          </div>
        )}
        {tab === 'health' && (
          <div className="border border-ws-black/15 bg-ws-page px-4 py-3">
            <p className="text-[13px] font-bold text-ws-black">Health starts with Today&apos;s Run Status in this milestone.</p>
            <p className="mt-1 text-[13px] text-ws-black/60">Automation logs and source-specific diagnostics should be added in a follow-up health plan.</p>
          </div>
        )}
        {tab === 'settings' && (
          <div className="flex flex-col gap-5">
            <CaptureSettings />
            <details className="border-[2px] border-ws-black/20 bg-ws-page p-4">
              <summary className="cursor-pointer text-[13px] font-black uppercase tracking-[0.1em] text-ws-black/65">
                Legacy briefing import
              </summary>
              <p className="mt-2 mb-4 text-[13px] leading-relaxed text-ws-black/60">
                Use this only if the candidate inbox is missing articles.
              </p>
              <BriefingImport password={password} />
            </details>
          </div>
        )}
      </div>
    </section>
  )
}
```

- [ ] **Step 2: Run lint**

Run:

```powershell
npm run lint
```

Expected: PASS.

- [ ] **Step 3: Browser smoke check secondary tabs**

Open `/admin`, switch to full desk mode.

Verify:

- Issue Desk tab shows existing `AddToIssue` and `PublishedIssueEditor`.
- Future Queue tab states held candidates live under Candidate Triage -> Held.
- Health tab states status is covered by Today's Run Status.
- Settings tab shows Capture Settings and hidden legacy briefing import.

- [ ] **Step 4: Commit Task 7**

```powershell
git add app/admin/_secondary-admin-tabs.tsx
git commit -m "feat: organize secondary admin areas"
```

---

### Task 8: Final Verification And Cleanup

**Files:**
- Modify: `tasks/todo.md`
- Inspect: all changed admin files

- [ ] **Step 1: Run full verification**

Run:

```powershell
npm run lint
npm run test -- tests/lib/admin-readiness.test.ts tests/lib/issue-memory.test.ts tests/lib/title-dedupe.test.ts tests/lib/draft-articles.test.ts
npm run build
```

Expected:

- ESLint passes.
- Targeted tests pass.
- Production build completes.

- [ ] **Step 2: Browser check desktop**

Start local dev if needed:

```powershell
npm run dev -- -p 3034
```

Open `http://localhost:3034/admin`.

Verify:

- Sign-in works.
- Today's Run Status is the first authed screen.
- Primary action moves to the expected daily step.
- Guided step nav shows Status, Intake, Choose, Edit, Check, Publish.
- Full desk toggle reveals all daily sections and secondary tabs.
- Candidate triage shows Keep/Reject/Hold.
- Draft split editor renders editor and preview columns.
- Check step renders blockers/warnings and correct publish button state.

- [ ] **Step 3: Browser check mobile**

Use a mobile viewport around 390px wide.

Verify:

- Header actions wrap without overlap.
- Step nav scrolls horizontally.
- Draft editor uses Edit/Preview tabs.
- Candidate action buttons are reachable without hover.

- [ ] **Step 4: Update task notes**

Append this to `tasks/todo.md`:

```md
# Task: Guided Daily Run Admin Rebuild

- [x] Add readiness model and today-status API.
- [x] Replace admin default with Today's Run Status and guided daily run shell.
- [x] Add Keep/Reject/Hold candidate triage.
- [x] Add draft split editor MVP.
- [x] Add blocker/warning publish readiness gate.
- [x] Organize secondary admin areas.
- [x] Verify lint, tests, production build, desktop admin, and mobile admin.

## Review

- Admin now opens on Today's Run Status and leads the editor through Status, Intake, Choose, Edit, Check, and Publish.
- Candidate review uses Keep, Reject, and Hold instead of checkbox-first importing.
- Draft editing has a structured editor with a live preview.
- Publish is guarded by blockers and warning acknowledgement.
- Secondary tools are grouped under Issue Desk, Future Queue, Health, and Settings.
```

- [ ] **Step 5: Commit final cleanup**

```powershell
git add tasks/todo.md
git commit -m "docs: record guided admin rebuild verification"
```

- [ ] **Step 6: Report status**

Final implementation report should include:

- Commits created
- Verification commands and results
- Any production-live checks not run
- Whether a push/deploy is still needed

Do not push or deploy unless the user explicitly asks.

---

## Self-Review Notes

Spec coverage:

- Today's Run Status: Tasks 1-3
- Guided hybrid daily run: Task 3
- Candidate Keep/Reject/Hold: Task 4
- Split editor and preview: Task 5
- Check + Publish blockers/warnings: Task 6
- Secondary areas: Task 7
- Testing/browser checks: Task 8

Intentional gaps for follow-up plans:

- Full Future Queue board with scheduled items
- Full Issue Desk item reordering/edit parity
- Automation source-specific health diagnostics
- Email/social generation

These gaps are not part of this first shippable daily-run rebuild.
