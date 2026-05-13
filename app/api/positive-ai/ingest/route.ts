import { NextRequest, NextResponse } from 'next/server'
import { isGoodNewsAdminAuthorized, goodNewsAdminSetupMessage } from '@/lib/good-news-admin-auth'
import { ingestConfiguredGoodNewsSources } from '@/lib/good-news-ingestion'

export const dynamic = 'force-dynamic'

interface Body {
  adminPassword?: string
}

export async function POST(request: NextRequest) {
  let body: Body = {}
  try {
    body = await request.json()
  } catch {
    body = {}
  }

  if (!isGoodNewsAdminAuthorized(request, body)) {
    return NextResponse.json({ error: goodNewsAdminSetupMessage() }, { status: 401 })
  }

  const result = await ingestConfiguredGoodNewsSources()
  return NextResponse.json(result)
}
