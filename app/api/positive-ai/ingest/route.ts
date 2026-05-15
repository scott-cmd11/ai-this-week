import { NextRequest, NextResponse } from 'next/server'
import { isGoodNewsAdminAuthorized, goodNewsAdminSetupMessage } from '@/lib/good-news-admin-auth'
import { ingestConfiguredGoodNewsSources } from '@/lib/good-news-ingestion'
import type { GoodNewsStatus } from '@/lib/good-news-types'

export const dynamic = 'force-dynamic'

interface Body {
  adminPassword?: string
  status?: GoodNewsStatus
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

  const result = await ingestConfiguredGoodNewsSources({
    status: coerceIngestStatus(body.status),
  })
  return NextResponse.json(result)
}

function coerceIngestStatus(value: GoodNewsStatus | undefined): GoodNewsStatus {
  return value && ['pending', 'approved', 'published'].includes(value) ? value : 'pending'
}
