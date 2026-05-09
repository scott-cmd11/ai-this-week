import { NextRequest, NextResponse } from 'next/server'
import { listDraftIssues } from '@/lib/issue-store'

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

    const issues = await listDraftIssues()
    return NextResponse.json({ issues }, { status: 200 })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
