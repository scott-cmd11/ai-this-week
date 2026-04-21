import { NextRequest, NextResponse } from 'next/server'
import { Client } from '@notionhq/client'
import { revalidatePath } from 'next/cache'

// Archives a Notion page (moves it to the trash). Used by the admin
// "Drafts ready to publish" list to delete unwanted drafts — typically
// duplicates produced before the smart-append / Friday-cadence fixes.
//
// Notion doesn't hard-delete pages via the API. Archiving sends the
// page to the trash where it can be restored or permanently purged
// from the Notion UI.
export async function POST(request: NextRequest) {
  const adminPassword = process.env.ADMIN_PASSWORD
  const notionToken = process.env.NOTION_TOKEN

  if (!adminPassword || !notionToken) {
    return NextResponse.json(
      { error: 'Server configuration error: missing environment variables.' },
      { status: 500 }
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
    const notion = new Client({ auth: notionToken })

    await notion.pages.update({
      page_id: body.pageId,
      archived: true,
    })

    // If the page happened to be published, its disappearance needs to
    // propagate to the public site immediately.
    revalidatePath('/', 'layout')

    return NextResponse.json({ ok: true })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
