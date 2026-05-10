import { NextRequest, NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import { adminChecksFingerprint } from '@/lib/admin-readiness'
import { buildIssueReadiness } from '@/lib/admin-issue-readiness'
import { getIssueBlocks, getIssueById, publishIssue } from '@/lib/issue-store'

export async function POST(request: NextRequest) {
  const adminPassword = process.env.ADMIN_PASSWORD

  if (!adminPassword) {
    return NextResponse.json(
      { error: 'Server configuration error: missing environment variables.' },
      { status: 500 },
    )
  }

  let body: { password: string; pageId: string; checksFingerprint?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 })
  }

  if (!body.password || body.password !== adminPassword) {
    return NextResponse.json({ error: 'Incorrect password.' }, { status: 401 })
  }
  if (!body.pageId || typeof body.pageId !== 'string') {
    return NextResponse.json({ error: 'pageId is required.' }, { status: 400 })
  }

  try {
    const draft = await getIssueById(body.pageId)
    if (!draft) {
      return NextResponse.json({ error: 'Issue not found.' }, { status: 404 })
    }
    if (draft.published) {
      return NextResponse.json({ error: 'This issue is already published.' }, { status: 409 })
    }

    const blocks = await getIssueBlocks(body.pageId)
    const { readiness } = await buildIssueReadiness({
      issueDate: draft.issueDate,
      draft,
      blocks,
    })

    if (readiness.blockers.length > 0) {
      return NextResponse.json(
        {
          error: 'Resolve publish blockers before publishing.',
          blockers: readiness.blockers,
          warnings: readiness.warnings,
        },
        { status: 409 },
      )
    }

    if (readiness.warnings.length > 0) {
      const currentFingerprint = adminChecksFingerprint([...readiness.blockers, ...readiness.warnings])
      if (!body.checksFingerprint || body.checksFingerprint !== currentFingerprint) {
        return NextResponse.json(
          {
            error: 'Refresh and acknowledge the current publish warnings before publishing.',
            blockers: readiness.blockers,
            warnings: readiness.warnings,
            checksFingerprint: currentFingerprint,
          },
          { status: 409 },
        )
      }
    }

    const issue = await publishIssue(body.pageId)
    revalidatePath('/', 'layout')
    return NextResponse.json({ ok: true, issue })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
