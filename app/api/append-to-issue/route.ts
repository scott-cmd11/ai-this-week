import { NextRequest, NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import OpenAI from 'openai'
import { fetchArticle, hostnameFallback, isPublishedDateFreshForIssue } from '@/lib/article-fetcher'
import { generateAnnotation, polishAnnotation } from '@/lib/ai-annotation'
import { buildKnownTitleList, buildKnownUrlMap } from '@/lib/known-urls'
import { findIssueMemoryWarnings } from '@/lib/issue-memory'
import { normalizeUrl } from '@/lib/url-normalize'
import {
  appendArticleToIssue,
  appendEventToIssue,
  findOrCreateDraftByDate,
  getIssueTargetByDate,
  getIssueTargetById,
} from '@/lib/issue-store'

interface BaseRequestBody {
  adminPassword?: string
  issueId?: string
  issueDate?: string
  force?: boolean
  dryRun?: boolean
}

interface ArticleBody extends BaseRequestBody {
  type: 'article'
  url?: string
  annotation?: string
  autoAnnotate?: boolean
  polishAnnotation?: boolean
  imageUrl?: string
  category?: string
  allowOlderSource?: boolean
}

interface EventBody extends BaseRequestBody {
  type: 'event'
  title?: string
  when?: string
  where?: string
  description?: string
  url?: string
}

type RequestBody = ArticleBody | EventBody

export async function POST(request: NextRequest) {
  const adminPassword = process.env.ADMIN_PASSWORD
  const openaiApiKey = process.env.OPENAI_API_KEY

  if (!adminPassword) {
    return NextResponse.json(
      { error: 'Server configuration error: missing environment variables.' },
      { status: 500 },
    )
  }

  let body: RequestBody
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 })
  }

  if (!body.adminPassword || body.adminPassword !== adminPassword) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
  }

  const issue = body.issueId
    ? await getIssueTargetById(body.issueId)
    : body.issueDate
      ? (await getIssueTargetByDate(body.issueDate, false)) ?? await findOrCreateDraftByDate(body.issueDate)
      : null

  if (!issue) {
    return NextResponse.json({ error: 'Choose an issue or enter an issue date first.' }, { status: 404 })
  }

  if (body.type === 'article') {
    if (!openaiApiKey && body.autoAnnotate !== false && !body.annotation?.trim()) {
      return NextResponse.json(
        { error: 'OPENAI_API_KEY is required to write an article summary automatically.' },
        { status: 500 },
      )
    }
    return appendArticle(request, body, openaiApiKey, issue)
  }

  if (body.type === 'event') {
    return appendEvent(body, issue)
  }

  return NextResponse.json({ error: 'type must be article or event.' }, { status: 400 })
}

async function appendArticle(
  request: NextRequest,
  body: ArticleBody,
  openaiApiKey: string | undefined,
  issue: Awaited<ReturnType<typeof getIssueTargetById>>,
) {
  if (!issue) return NextResponse.json({ error: 'Issue not found.' }, { status: 404 })

  const url = body.url?.trim()
  if (!url || !url.startsWith('http')) {
    return NextResponse.json({ error: 'Valid article URL is required.' }, { status: 400 })
  }

  const duplicate = await findDuplicate(url)
  if (duplicate && !body.force) {
    return NextResponse.json({
      error: 'duplicate',
      message: `This URL was already added to Issue #${duplicate.issueNumber} on ${duplicate.issueDate}${duplicate.published ? ' (published)' : ' (draft)'}. Re-submit with force: true to add anyway.`,
      duplicate,
    }, { status: 409 })
  }

  const openai = openaiApiKey ? new OpenAI({ apiKey: openaiApiKey }) : null
  const fetchResult = await fetchArticle(url)
  const title = fetchResult.title || hostnameFallback(url)
  const publishedDate = fetchResult.publishedDate
  const imageUrl = body.imageUrl?.trim() || fetchResult.imageUrl || null

  const issueMemoryWarnings = await findIssueMemory(title, issue.issueId)
  if (issueMemoryWarnings.length > 0 && !body.force) {
    return NextResponse.json({
      error: 'issue_memory',
      message: issueMemoryWarnings[0].message,
      warnings: issueMemoryWarnings,
    }, { status: 409 })
  }

  if (!body.allowOlderSource && !isPublishedDateFreshForIssue(publishedDate, issue.issueDate)) {
    return NextResponse.json({
      error: 'stale_source',
      message: `Publisher date looks outside this issue's freshness window: ${publishedDate}. Turn on the older-source override if you still want to add it.`,
      publishedDate,
      issueDate: issue.issueDate,
    }, { status: 409 })
  }

  let annotation: string
  if (body.annotation?.trim()) {
    annotation = body.polishAnnotation && openai
      ? await polishAnnotation(openai, body.annotation, { knownTitle: title, url })
      : body.annotation.trim()
  } else if (body.autoAnnotate !== false && openai) {
    annotation = await generateAnnotation(openai, url, { knownTitle: title })
  } else {
    annotation = '[Add annotation]'
  }

  if (body.dryRun) {
    return NextResponse.json({
      success: true,
      dryRun: true,
      issue,
      article: { title, url, publishedDate, imageUrl, annotation, category: body.category?.trim() || null },
      duplicate,
      issueMemoryWarnings,
    })
  }

  const result = await appendArticleToIssue(issue, {
    title,
    annotation,
    url,
    publishedDate,
    imageUrl,
    category: body.category?.trim() || null,
  })

  revalidatePath('/', 'layout')

  return NextResponse.json({
    success: true,
    title,
    publishedDate,
    imageUrl,
    issue,
    ...result,
    issueMemoryWarnings,
    path: `/issues/${issue.issueDate}`,
    requestUrl: request.url,
  })
}

async function appendEvent(
  body: EventBody,
  issue: Awaited<ReturnType<typeof getIssueTargetById>>,
) {
  if (!issue) return NextResponse.json({ error: 'Issue not found.' }, { status: 404 })

  const title = body.title?.trim()
  const url = body.url?.trim()
  if (!title) return NextResponse.json({ error: 'Event title is required.' }, { status: 400 })
  if (!url || !url.startsWith('http')) {
    return NextResponse.json({ error: 'Valid event URL is required.' }, { status: 400 })
  }

  const duplicate = await findDuplicate(url)
  if (duplicate && !body.force) {
    return NextResponse.json({
      error: 'duplicate',
      message: `This event URL was already added to Issue #${duplicate.issueNumber} on ${duplicate.issueDate}${duplicate.published ? ' (published)' : ' (draft)'}. Re-submit with force: true to add anyway.`,
      duplicate,
    }, { status: 409 })
  }

  const issueMemoryWarnings = await findIssueMemory(title, issue.issueId)
  if (issueMemoryWarnings.length > 0 && !body.force) {
    return NextResponse.json({
      error: 'issue_memory',
      message: issueMemoryWarnings[0].message,
      warnings: issueMemoryWarnings,
    }, { status: 409 })
  }

  if (body.dryRun) {
    return NextResponse.json({
      success: true,
      dryRun: true,
      issue,
      event: {
        title,
        when: body.when?.trim() ?? '',
        where: body.where?.trim() ?? '',
        description: body.description?.trim() || null,
        url,
      },
      duplicate,
      issueMemoryWarnings,
    })
  }

  const result = await appendEventToIssue(issue, {
    title,
    when: body.when?.trim() ?? '',
    where: body.where?.trim() ?? '',
    description: body.description?.trim() || null,
    url,
  })

  revalidatePath('/', 'layout')

  return NextResponse.json({
    success: true,
    issue,
    ...result,
    issueMemoryWarnings,
    path: `/issues/${issue.issueDate}`,
  })
}

async function findDuplicate(url: string) {
  const normalized = normalizeUrl(url)
  if (!normalized) return null
  const knownMap = await buildKnownUrlMap(90)
  return knownMap.get(normalized) ?? null
}

async function findIssueMemory(title: string, targetIssueId: string) {
  const knownTitles = (await buildKnownTitleList(90))
    .filter(entry => entry.pageId !== targetIssueId)
  return findIssueMemoryWarnings(title, knownTitles)
}
