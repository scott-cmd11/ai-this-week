import { NextRequest, NextResponse } from 'next/server'
import { Client } from '@notionhq/client'
import OpenAI from 'openai'
import { fetchArticle, hostnameFallback } from '@/lib/article-fetcher'
import { captureArticleToTodaysDraft } from '@/lib/notion-capture'
import { generateAnnotation } from '@/lib/ai-annotation'

// ─── Types ──────────────────────────────────────────────────────────────────────

interface RequestBody {
  token?: string
  adminPassword?: string
  url: string
  annotation?: string
  autoAnnotate?: boolean
  imageUrl?: string
}

// ─── Route handler ───────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  const captureToken = process.env.CAPTURE_TOKEN
  const adminPassword = process.env.ADMIN_PASSWORD
  const notionToken = process.env.NOTION_TOKEN
  const notionDatabaseId = process.env.NOTION_DATABASE_ID
  const openaiApiKey = process.env.OPENAI_API_KEY

  if (!captureToken || !notionToken || !notionDatabaseId || !openaiApiKey) {
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

  const { url, annotation, autoAnnotate = true, imageUrl: imageUrlOverride } = body

  const notion = new Client({ auth: notionToken })
  const openai = new OpenAI({ apiKey: openaiApiKey })

  try {
    // Fetch article metadata (title, og:image) — may also be re-fetched
    // inside generateAnnotation() if we end up auto-annotating; cheap to
    // call twice since fetchArticle handles its own caching paths.
    const fetchResult = await fetchArticle(url)
    const { title } = fetchResult
    const fetchedImageUrl = fetchResult.imageUrl

    // Determine annotation: explicit > AI auto-generated > placeholder
    let resolvedAnnotation: string
    if (annotation) {
      resolvedAnnotation = annotation
    } else if (autoAnnotate !== false) {
      resolvedAnnotation = await generateAnnotation(openai, url, { knownTitle: title })
    } else {
      resolvedAnnotation = '[Add annotation]'
    }

    // Append to today's draft (creating one if needed) — shared logic in lib/notion-capture
    const result = await captureArticleToTodaysDraft(notion, notionDatabaseId, {
      title: title || hostnameFallback(url),
      annotation: resolvedAnnotation,
      url,
      imageUrl: imageUrlOverride ?? fetchedImageUrl ?? null,
    })

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
