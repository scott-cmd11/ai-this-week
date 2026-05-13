import { NextRequest, NextResponse } from 'next/server'
import { isGoodNewsAdminAuthorized, goodNewsAdminSetupMessage } from '@/lib/good-news-admin-auth'
import { createGoodNewsSummarizer } from '@/lib/good-news-summarizer'
import { normalizeGoodNewsUrl } from '@/lib/good-news-scoring'
import { isGoodNewsStoreConfigured, listGoodNewsStories, upsertGoodNewsStories } from '@/lib/good-news-store'
import type { GoodNewsStatus, GoodNewsStory } from '@/lib/good-news-types'

export const dynamic = 'force-dynamic'

interface ManualStoryBody {
  adminPassword?: string
  url?: string
  title?: string
}

export async function GET(request: NextRequest) {
  if (!isGoodNewsAdminAuthorized(request)) {
    return NextResponse.json({ error: goodNewsAdminSetupMessage() }, { status: 401 })
  }

  const statuses = parseStatuses(request.nextUrl.searchParams.get('status'))
  const stories = await listGoodNewsStories({
    status: statuses,
    limit: Number(request.nextUrl.searchParams.get('limit') ?? 100),
  })

  return NextResponse.json({
    configured: isGoodNewsStoreConfigured(),
    stories,
    setup: isGoodNewsStoreConfigured()
      ? undefined
      : 'Using seeded local data. Apply docs/supabase/ai_good_news.sql for deployed persistence.',
  })
}

export async function POST(request: NextRequest) {
  let body: ManualStoryBody
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 })
  }

  if (!isGoodNewsAdminAuthorized(request, body)) {
    return NextResponse.json({ error: goodNewsAdminSetupMessage() }, { status: 401 })
  }

  const url = body.url?.trim()
  const title = body.title?.trim()
  if (!url || !title) {
    return NextResponse.json({ error: 'Title and source URL are required.' }, { status: 400 })
  }

  try {
    const summarizer = createGoodNewsSummarizer()
    const summary = await summarizer.summarize({
      title,
      source_name: hostName(url),
      source_url: url,
      canonical_url: url,
      published_at: new Date().toISOString(),
      discovered_at: new Date().toISOString(),
      summary: title,
      content_text: title,
    })
    const story: GoodNewsStory = {
      id: `manual-${Date.now().toString(36)}`,
      title,
      source_name: hostName(url),
      source_url: url,
      canonical_url: normalizeGoodNewsUrl(url),
      published_at: new Date().toISOString(),
      discovered_at: new Date().toISOString(),
      summary: summary.summary,
      why_it_matters: summary.why_it_matters,
      category: summary.category,
      tags: summary.tags,
      positivity_score: summary.positivity_score,
      credibility_score: summary.credibility_score,
      evidence_notes: summary.evidence_notes,
      status: 'pending',
    }
    const [saved] = await upsertGoodNewsStories([story])
    return NextResponse.json({ story: saved })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Manual story add failed.'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

function parseStatuses(raw: string | null): GoodNewsStatus[] | undefined {
  if (!raw) return undefined
  const allowed = new Set<GoodNewsStatus>(['pending', 'approved', 'rejected', 'published'])
  const statuses = raw.split(',').map(value => value.trim()).filter((value): value is GoodNewsStatus => allowed.has(value as GoodNewsStatus))
  return statuses.length > 0 ? statuses : undefined
}

function hostName(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return 'Manual source'
  }
}
