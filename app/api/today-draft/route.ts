import { NextRequest, NextResponse } from 'next/server'
import { parseDailyArticles } from '@/lib/draft-articles'
import { issueDateFor } from '@/lib/issue-date'
import { findSubjectDuplicate, subjectDuplicateMessage } from '@/lib/article-dedupe'
import { buildKnownTitleList } from '@/lib/known-urls'
import { getIssueByDate, getIssueBlocks } from '@/lib/issue-store'

interface DraftDuplicateWarning {
  index: number
  title: string
  message: string
}

export async function GET(request: NextRequest) {
  try {
    const adminPassword = process.env.ADMIN_PASSWORD
    if (!adminPassword) {
      return NextResponse.json(
        { error: 'Server configuration error: missing environment variables.' },
        { status: 500 },
      )
    }

    const password = request.headers.get('x-admin-password')
    if (!password || password !== adminPassword) {
      return NextResponse.json({ error: 'Incorrect password.' }, { status: 401 })
    }

    const today = issueDateFor()
    const draft = await getIssueByDate(today, false)

    if (!draft || draft.published) {
      return NextResponse.json({ draft: null, articles: [], articleCount: 0 })
    }

    const blocks = await getIssueBlocks(draft.id)
    const articles = parseDailyArticles(blocks)
    const knownTitles = (await buildKnownTitleList(30)).filter(entry => entry.pageId !== draft.id)
    const duplicateWarnings: DraftDuplicateWarning[] = []
    const seenDraftTitles: Array<{ title: string }> = []
    articles.forEach((article, index) => {
      if (!article.title) return
      const duplicate = findSubjectDuplicate(article.title, knownTitles, seenDraftTitles)
      const message = subjectDuplicateMessage(duplicate)
      if (message) duplicateWarnings.push({ index: index + 1, title: article.title, message })
      seenDraftTitles.push({ title: article.title })
    })

    return NextResponse.json({
      draft: {
        id: draft.id,
        issueNumber: draft.issueNumber,
        issueDate: draft.issueDate,
        title: draft.title,
      },
      articles,
      articleCount: articles.length,
      duplicateWarnings,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
