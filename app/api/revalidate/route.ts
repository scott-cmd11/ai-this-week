import { NextRequest, NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'

// On-demand revalidation for the public site.
// Called from the admin UI after you publish/unpublish an issue in Notion
// so the change shows up immediately instead of waiting for the
// revalidate-every-5-min background refresh.
export async function POST(request: NextRequest) {
  const adminPassword = process.env.ADMIN_PASSWORD
  if (!adminPassword) {
    return NextResponse.json({ error: 'Server configuration error.' }, { status: 500 })
  }

  let body: { password: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 })
  }

  if (!body.password || body.password !== adminPassword) {
    return NextResponse.json({ error: 'Incorrect password.' }, { status: 401 })
  }

  // 'layout' type invalidates every route that uses the root layout —
  // homepage, issues list, issue detail pages, sections, feed, sitemap.
  revalidatePath('/', 'layout')

  return NextResponse.json({
    ok: true,
    revalidatedAt: new Date().toISOString(),
  })
}
