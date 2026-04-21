import { NextRequest, NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'

// On-demand revalidation. Use case: you edited an already-published issue
// in Notion (typo fix, summary tweak) and want the change live right away
// instead of waiting for the 5-min background refresh.
// For new publications use /api/publish-issue — it both flips Published
// AND revalidates in one call.
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

  revalidatePath('/', 'layout')

  return NextResponse.json({ ok: true })
}
