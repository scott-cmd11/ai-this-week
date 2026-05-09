#!/usr/bin/env node
import { Client } from '@notionhq/client'

function requireEnv(name) {
  const value = process.env[name]
  if (!value) throw new Error(`Missing environment variable: ${name}`)
  return value
}

function richTextPlain(richText = []) {
  return richText.map(segment => segment?.plain_text ?? '').join('')
}

function richTextSegments(richText = []) {
  return richText.map(segment => ({
    text: segment?.plain_text ?? '',
    bold: segment?.annotations?.bold ?? false,
    href: segment?.text?.link?.url ?? segment?.href ?? null,
  }))
}

function slugify(text) {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
}

function mapBlock(block) {
  const type = block.type
  const content = block[type]
  switch (type) {
    case 'paragraph': {
      const richText = content?.rich_text ?? []
      return {
        id: block.id,
        type: 'paragraph',
        content: richTextPlain(richText),
        richText: richTextSegments(richText),
      }
    }
    case 'heading_2': {
      const text = richTextPlain(content?.rich_text ?? [])
      return { id: block.id, type: 'heading_2', content: text, headingId: slugify(text) }
    }
    case 'heading_3':
      return { id: block.id, type: 'heading_3', content: richTextPlain(content?.rich_text ?? []) }
    case 'bulleted_list_item': {
      const richText = content?.rich_text ?? []
      return {
        id: block.id,
        type: 'bulleted_list_item',
        content: richTextPlain(richText),
        richText: richTextSegments(richText),
      }
    }
    case 'numbered_list_item': {
      const richText = content?.rich_text ?? []
      return {
        id: block.id,
        type: 'numbered_list_item',
        content: richTextPlain(richText),
        richText: richTextSegments(richText),
      }
    }
    case 'bookmark':
      return {
        id: block.id,
        type: 'bookmark',
        content: content?.caption?.[0]?.plain_text ?? 'Read more',
        href: content?.url ?? '',
      }
    case 'divider':
      return { id: block.id, type: 'divider', content: '' }
    case 'image': {
      const url = content?.external?.url ?? content?.file?.url ?? ''
      const caption = richTextPlain(content?.caption ?? [])
      return { id: block.id, type: 'image', content: caption || url, href: url }
    }
    default:
      return { id: block.id, type: 'paragraph', content: richTextPlain(content?.rich_text ?? []) }
  }
}

function mapPage(page) {
  const props = page.properties
  const issueDate = props['Issue Date']?.date?.start ?? ''
  const issueNumber = props['Issue Number']?.number ?? 0
  if (!issueDate || !issueNumber) return null
  return {
    notionId: page.id,
    title: props.Title?.title?.[0]?.plain_text ?? `AI Today - ${issueDate}`,
    issue_date: issueDate,
    issue_number: issueNumber,
    published: props.Published?.checkbox ?? false,
    summary: props.Summary?.rich_text?.[0]?.plain_text ?? null,
    ai_assisted: props['AI Assisted']?.checkbox ?? true,
  }
}

async function listAllNotionIssues(notion, databaseId) {
  const pages = []
  let cursor
  do {
    const response = await notion.databases.query({
      database_id: databaseId,
      page_size: 100,
      start_cursor: cursor,
      sorts: [{ property: 'Issue Date', direction: 'ascending' }],
    })
    pages.push(...response.results)
    cursor = response.has_more ? response.next_cursor ?? undefined : undefined
  } while (cursor)
  return pages
}

async function listAllBlocks(notion, pageId) {
  const blocks = []
  let cursor
  do {
    const response = await notion.blocks.children.list({
      block_id: pageId,
      page_size: 100,
      start_cursor: cursor,
    })
    blocks.push(...response.results)
    cursor = response.has_more ? response.next_cursor ?? undefined : undefined
  } while (cursor)
  return blocks.map(mapBlock)
}

async function supabaseRequest(path, init = {}) {
  const url = requireEnv('SUPABASE_URL').replace(/\/$/, '')
  const key = requireEnv('SUPABASE_SERVICE_ROLE_KEY')
  const response = await fetch(`${url}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
      ...(init.headers ?? {}),
    },
  })
  if (!response.ok) {
    const body = await response.text().catch(() => '')
    throw new Error(`Supabase request failed (${response.status}): ${body || response.statusText}`)
  }
  return response.status === 204 ? null : response.json()
}

async function main() {
  const dryRun = process.argv.includes('--dry-run')
  const notion = new Client({ auth: requireEnv('NOTION_TOKEN') })
  const databaseId = requireEnv('NOTION_DATABASE_ID')
  const pages = await listAllNotionIssues(notion, databaseId)
  const rows = []

  for (const page of pages) {
    const mapped = mapPage(page)
    if (!mapped) continue
    const blocks = await listAllBlocks(notion, mapped.notionId)
    rows.push({
      title: mapped.title,
      issue_date: mapped.issue_date,
      issue_number: mapped.issue_number,
      published: mapped.published,
      summary: mapped.summary,
      ai_assisted: mapped.ai_assisted,
      blocks,
      published_at: mapped.published ? `${mapped.issue_date}T12:00:00Z` : null,
    })
    console.log(`${dryRun ? 'Would migrate' : 'Prepared'} issue #${mapped.issue_number} ${mapped.issue_date}: ${blocks.length} blocks`)
  }

  if (dryRun) {
    console.log(JSON.stringify({
      dryRun: true,
      issueCount: rows.length,
      publishedCount: rows.filter(row => row.published).length,
      draftCount: rows.filter(row => !row.published).length,
    }, null, 2))
    return
  }

  if (rows.length === 0) {
    console.log(JSON.stringify({ migrated: 0 }, null, 2))
    return
  }

  const result = await supabaseRequest('issues?on_conflict=issue_date', {
    method: 'POST',
    headers: { Prefer: 'resolution=merge-duplicates,return=representation' },
    body: JSON.stringify(rows),
  })
  console.log(JSON.stringify({ migrated: result.length }, null, 2))
}

main().catch(error => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exitCode = 1
})
