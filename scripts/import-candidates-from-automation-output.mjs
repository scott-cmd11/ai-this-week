#!/usr/bin/env node
import fs from 'node:fs/promises'
import path from 'node:path'

const DEFAULT_API_BASE = 'https://aitoday.vercel.app'

function usage() {
  console.log(`Usage:
  node scripts/import-candidates-from-automation-output.mjs --source "Google Alerts Daily Digest" --type google_alerts --file path/to/google_alerts_repair.json

Options:
  --file       JSON output file from an automation run. Can be passed more than once.
  --source     Source label to store in Candidate inbox.
  --type       Source type: google_alerts, agriculture, ai_voices, research, canada_briefing, manual, other.
  --api-base   API base URL. Defaults to ${DEFAULT_API_BASE}.
  --dry-run    Print normalized candidates without posting.

Environment:
  ARTICLE_CANDIDATE_INGEST_TOKEN is required unless --dry-run is used.
`)
}

function readArg(name) {
  const index = process.argv.indexOf(name)
  if (index === -1) return null
  return process.argv[index + 1] ?? null
}

function readAllArgs(name) {
  const values = []
  for (let i = 0; i < process.argv.length; i++) {
    if (process.argv[i] === name && process.argv[i + 1]) values.push(process.argv[i + 1])
  }
  return values
}

function guessCategory(item, sourceType) {
  const haystack = `${item.topic ?? ''} ${item.title ?? ''} ${item.snippet ?? ''} ${item.summary ?? ''}`.toLowerCase()
  if (sourceType === 'agriculture') return 'Sectors & Applications'
  if (haystack.includes('canada') || haystack.includes('canadian') || haystack.includes('ottawa') || haystack.includes('winnipeg') || haystack.includes('toronto')) return 'Canada'
  if (haystack.includes('policy') || haystack.includes('regulation') || haystack.includes('privacy') || haystack.includes('governance') || haystack.includes('copyright')) return 'Policy & Regulation'
  if (haystack.includes('government') || haystack.includes('public sector') || haystack.includes('federal') || haystack.includes('sovereign')) return 'Government & Public Sector'
  if (haystack.includes('research') || haystack.includes('paper') || haystack.includes('arxiv') || haystack.includes('nature.com')) return 'Research'
  return 'Industry & Models'
}

function itemsFromPayload(payload) {
  if (Array.isArray(payload.selected)) return payload.selected
  if (Array.isArray(payload.items)) return payload.items
  if (Array.isArray(payload.candidates)) return payload.candidates
  return []
}

function normalizeItem(item, source, sourceType) {
  const title = item.title?.trim()
  const url = (item.url ?? item.canonical_url ?? item.link ?? '').trim()
  if (!title || !url) return null
  return {
    title,
    url,
    summary: item.snippet ?? item.summary ?? item.description ?? 'See source for details.',
    source,
    sourceType,
    publishedAt: item.published ?? item.published_at ?? item.published_local ?? item.published_raw ?? null,
    category: item.category ?? guessCategory(item, sourceType),
    score: typeof item.score === 'number' ? item.score : undefined,
    scoreReasons: [
      `Generated from ${source} automation output`,
      item.topic ? `Topic: ${item.topic}` : '',
      ...(Array.isArray(item.score_reasons) ? item.score_reasons : []),
      ...(Array.isArray(item.scoreReasons) ? item.scoreReasons : []),
    ].filter(Boolean),
  }
}

async function main() {
  if (process.argv.includes('--help')) {
    usage()
    return
  }

  const files = readAllArgs('--file')
  const source = readArg('--source')
  const sourceType = readArg('--type') ?? 'other'
  const apiBase = (readArg('--api-base') ?? DEFAULT_API_BASE).replace(/\/$/, '')
  const dryRun = process.argv.includes('--dry-run')
  const token = process.env.ARTICLE_CANDIDATE_INGEST_TOKEN

  if (files.length === 0 || !source) {
    usage()
    process.exitCode = 1
    return
  }
  if (!dryRun && !token) {
    console.error('ARTICLE_CANDIDATE_INGEST_TOKEN is required unless --dry-run is used.')
    process.exitCode = 1
    return
  }

  const candidates = []
  for (const file of files) {
    const absolute = path.resolve(file)
    const payload = JSON.parse(await fs.readFile(absolute, 'utf8'))
    for (const item of itemsFromPayload(payload)) {
      const candidate = normalizeItem(item, source, sourceType)
      if (candidate) candidates.push(candidate)
    }
  }

  if (dryRun) {
    console.log(JSON.stringify({ count: candidates.length, candidates: candidates.slice(0, 10) }, null, 2))
    return
  }

  const response = await fetch(`${apiBase}/api/article-candidates`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ candidates }),
  })
  const body = await response.json().catch(async () => ({ text: await response.text() }))
  if (!response.ok) {
    console.error(JSON.stringify({ status: response.status, body }, null, 2))
    process.exitCode = 1
    return
  }
  console.log(JSON.stringify({ status: response.status, attempted: candidates.length, added: body.added }, null, 2))
}

main().catch(error => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exitCode = 1
})
