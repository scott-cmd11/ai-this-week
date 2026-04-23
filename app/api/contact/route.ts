import { NextRequest, NextResponse } from 'next/server'
import { Client } from '@notionhq/client'

// Public contact form submission handler.
// Creates a new page in the Notion "Contact Messages" database identified
// by NOTION_CONTACT_DATABASE_ID. Not password-protected (it's a public
// form) — uses a hidden honeypot field to stop the noisiest bots.

interface Body {
  name: string
  email: string
  message: string
  // Honeypot — legitimate users leave this blank. Bots happily fill every
  // visible field, so a hidden field that's filled = bot. Reject silently.
  website?: string
}

const MAX_NAME = 120
const MAX_EMAIL = 200
const MAX_MESSAGE = 5000
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export async function POST(request: NextRequest) {
  const notionToken = process.env.NOTION_TOKEN
  const contactDbId = process.env.NOTION_CONTACT_DATABASE_ID

  if (!notionToken || !contactDbId) {
    return NextResponse.json(
      { error: 'Contact form is not configured yet. Please email directly.' },
      { status: 503 }
    )
  }

  let body: Body
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request.' }, { status: 400 })
  }

  // Honeypot check — return success so bots don't retry, but do nothing.
  if (body.website && body.website.trim().length > 0) {
    return NextResponse.json({ ok: true })
  }

  // Validation
  const name = (body.name ?? '').trim()
  const email = (body.email ?? '').trim()
  const message = (body.message ?? '').trim()

  if (!name || name.length > MAX_NAME) {
    return NextResponse.json({ error: 'Please enter your name.' }, { status: 400 })
  }
  if (!email || email.length > MAX_EMAIL || !EMAIL_RE.test(email)) {
    return NextResponse.json({ error: 'Please enter a valid email address.' }, { status: 400 })
  }
  if (!message || message.length > MAX_MESSAGE) {
    return NextResponse.json(
      { error: `Please enter a message (up to ${MAX_MESSAGE} characters).` },
      { status: 400 }
    )
  }

  try {
    const notion = new Client({ auth: notionToken })
    await notion.pages.create({
      parent: { database_id: contactDbId },
      properties: {
        // Property names must match what the Notion database schema exposes.
        // Set up instructions live in the contact page's setup doc.
        Name: { title: [{ type: 'text', text: { content: name } }] },
        Email: { email },
        Message: { rich_text: [{ type: 'text', text: { content: message } }] },
        Replied: { checkbox: false },
      },
    })
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('Contact form Notion error:', err)
    return NextResponse.json(
      { error: 'Could not deliver your message. Please email scott.hazlitt@gmail.com directly.' },
      { status: 500 }
    )
  }
}
