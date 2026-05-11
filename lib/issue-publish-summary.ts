import 'server-only'

import OpenAI from 'openai'
import type { Issue, NotionBlock } from './types'
import { generateIssueDigest } from './issue-digest-ai'
import { deriveIssueSummary } from './issue-summary'

export async function buildIssuePublishSummary(issue: Issue, blocks: NotionBlock[]) {
  const saved = issue.summary?.trim()
  if (saved) return saved

  const fallback = deriveIssueSummary(blocks, issue)
  const openaiApiKey = process.env.OPENAI_API_KEY
  if (!openaiApiKey) return fallback

  const digest = await generateIssueDigest(new OpenAI({ apiKey: openaiApiKey }), blocks, issue)
  return digest.summary || fallback
}
