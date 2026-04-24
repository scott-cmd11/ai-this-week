import { NextRequest, NextResponse } from 'next/server'
import { getPublishedIssues, getIssueBlocks } from '@/lib/notion'
import type { NotionBlock } from '@/lib/types'

const ISSUES_TO_CHECK = 12

function normalizeUrl(url: string): string {
  try {
    const u = new URL(url)
    return `${u.hostname}${u.pathname}`.replace(/\/+$/, '').toLowerCase()
  } catch {
    return url.toLowerCase().replace(/\/+$/, '')
  }
}

function extractUrls(blocks: NotionBlock[]): string[] {
  const urls: string[] = []
  for (const block of blocks) {
    if (block.richText) {
      for (const seg of block.richText) {
        if (seg.href) urls.push(seg.href)
      }
    }
    if ((block.type === 'bookmark' || block.type === 'image') && block.href) {
      urls.push(block.href)
    }
  }
  return urls
}

export interface DuplicateMatch {
  url: string
  issueNumber: number
  issueDate: string
  issueTitle: string
}

export async function POST(request: NextRequest) {
  const adminPassword = process.env.ADMIN_PASSWORD
  if (!adminPassword) {
    return NextResponse.json({ error: 'Server configuration error.' }, { status: 500 })
  }

  let body: { password: string; urls: string[] }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 })
  }

  if (!body.password || body.password !== adminPassword) {
    return NextResponse.json({ error: 'Incorrect password.' }, { status: 401 })
  }

  if (!body.urls?.length) {
    return NextResponse.json({ duplicates: [] })
  }

  const inputNormalized = new Map(
    body.urls.map(url => [normalizeUrl(url), url])
  )

  const recentIssues = (await getPublishedIssues()).slice(0, ISSUES_TO_CHECK)

  const issueBlocks = await Promise.all(
    recentIssues.map(issue =>
      getIssueBlocks(issue.id).then(blocks => ({ issue, blocks }))
    )
  )

  const duplicates: DuplicateMatch[] = []

  for (const { issue, blocks } of issueBlocks) {
    const pastUrls = extractUrls(blocks).map(normalizeUrl)
    for (const [normalized, original] of inputNormalized) {
      if (pastUrls.includes(normalized)) {
        duplicates.push({
          url: original,
          issueNumber: issue.issueNumber,
          issueDate: issue.issueDate,
          issueTitle: issue.title,
        })
      }
    }
  }

  return NextResponse.json({ duplicates })
}
