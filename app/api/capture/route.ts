import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'
import { revalidatePath } from 'next/cache'
import { fetchArticle, hostnameFallback } from '@/lib/article-fetcher'
import { captureArticleToIssue, captureArticleToTodaysDraft } from '@/lib/issue-store'
import { generateAnnotation, polishAnnotation } from '@/lib/ai-annotation'
import { buildKnownUrlMap } from '@/lib/known-urls'
import { normalizeUrl } from '@/lib/url-normalize'

// ─── Types ──────────────────────────────────────────────────────────────────────

interface RequestBody {
  token?: string
  adminPassword?: string
  url: string
  annotation?: string
  autoAnnotate?: boolean
  /** When true AND `annotation` is supplied, run the user's note through the
   *  AI Today voice polish before saving. No-op if annotation is empty. */
  polishAnnotation?: boolean
  /** When true, skip the duplicate-URL check. Used by clients that have
   *  already shown the user a "you've published this before" warning and
   *  let them confirm "add anyway." */
  force?: boolean
  imageUrl?: string
  category?: string         // canonical category, e.g. "Canada"
  targetIssueId?: string
}

// ─── Route handler ───────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  const captureToken = process.env.CAPTURE_TOKEN
  const adminPassword = process.env.ADMIN_PASSWORD
  const openaiApiKey = process.env.OPENAI_API_KEY

  if (!captureToken || !openaiApiKey) {
    return NextResponse.json({ error: 'Server configuration error: missing environment variables.' }, { status: 500 })
  }

  let body: RequestBody
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 })
  }

  // Auth: accept either CAPTURE_TOKEN or ADMIN_PASSWORD
  const tokenOk = body.token && body.token === captureToken
  const adminOk = body.adminPassword && adminPassword && body.adminPassword === adminPassword
  if (!tokenOk && !adminOk) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
  }

  // Validate URL
  if (!body.url || !body.url.startsWith('http')) {
    return NextResponse.json({ error: 'Missing or invalid URL.' }, { status: 400 })
  }

  const { url, annotation, autoAnnotate = true, polishAnnotation: polishFlag = false, force = false, imageUrl: imageUrlOverride, category } = body
  const targetIssueId = body.targetIssueId?.trim()
  if (targetIssueId && !adminOk) {
    return NextResponse.json({ error: 'Admin password is required to update an existing issue.' }, { status: 401 })
  }

  const openai = new OpenAI({ apiKey: openaiApiKey })

  try {
    // Duplicate check — server-side backstop for the manual paste flows
    // (admin form, /capture mobile page, bookmarklet) that don't have access
    // to the known-urls hook used by the bulk import panels.
    // Skipped when the client has already warned the user and they chose
    // "add anyway" (force: true).
    if (!force) {
      const knownMap = await buildKnownUrlMap(30)
      const existing = knownMap.get(normalizeUrl(url))
      if (existing) {
        return NextResponse.json({
          error: 'duplicate',
          message: `This URL was already added to Issue #${existing.issueNumber} on ${existing.issueDate}${existing.published ? ' (published)' : ' (draft)'}. Re-submit with force: true to add anyway.`,
          duplicate: existing,
        }, { status: 409 })
      }
    }

    // Fetch article metadata (title, og:image) — may also be re-fetched
    // inside generateAnnotation() if we end up auto-annotating; cheap to
    // call twice since fetchArticle handles its own caching paths.
    const fetchResult = await fetchArticle(url)
    const { title, publishedDate } = fetchResult
    const fetchedImageUrl = fetchResult.imageUrl

    // Determine annotation: explicit (optionally polished) > AI auto-generated > placeholder
    let resolvedAnnotation: string
    if (annotation) {
      // User typed a note. Optionally polish it through the AI Today voice;
      // polish is best-effort and falls back to the user's text on failure.
      resolvedAnnotation = polishFlag
        ? await polishAnnotation(openai, annotation, { knownTitle: title, url })
        : annotation
    } else if (autoAnnotate !== false) {
      resolvedAnnotation = await generateAnnotation(openai, url, { knownTitle: title })
    } else {
      resolvedAnnotation = '[Add annotation]'
    }

    const article = {
      title: title || hostnameFallback(url),
      annotation: resolvedAnnotation,
      url,
      publishedDate,
      imageUrl: imageUrlOverride ?? fetchedImageUrl ?? null,
      category: category?.trim() || null,
    }
    const result = targetIssueId
      ? await captureArticleToIssue(targetIssueId, article)
      : await captureArticleToTodaysDraft(article)

    if (targetIssueId) revalidatePath('/', 'layout')

    return NextResponse.json({
      success: true,
      title: title ?? hostnameFallback(url),
      ...result,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
