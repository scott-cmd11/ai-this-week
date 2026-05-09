import { NextRequest, NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import { archiveIssue } from '@/lib/issue-store'

export async function POST(request: NextRequest) {
  const adminPassword = process.env.ADMIN_PASSWORD

  if (!adminPassword) {
    return NextResponse.json(
      { error: 'Server configuration error: missing environment variables.' },
      { status: 500 },
    )
  }

  let body: { password: string; pageId: string }
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
    await archiveIssue(body.pageId)
    revalidatePath('/', 'layout')
    return NextResponse.json({ ok: true })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
