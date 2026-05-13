import { NextRequest, NextResponse } from 'next/server'
import { generateAndSaveGoodNewsDigest } from '@/lib/good-news-store'
import { ingestConfiguredGoodNewsSources } from '@/lib/good-news-ingestion'

export const dynamic = 'force-dynamic'

function isCronAuthorized(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) return false
  const auth = request.headers.get('authorization')
  return auth === `Bearer ${secret}`
}

export async function GET(request: NextRequest) {
  if (!isCronAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
  }

  const ingestion = await ingestConfiguredGoodNewsSources()
  const digest = await generateAndSaveGoodNewsDigest()
  return NextResponse.json({ ingestion, digest })
}
