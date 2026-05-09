import { findSimilarTitle, titleSimilarity } from './title-dedupe'

export interface IssueMemoryCandidate {
  title: string
  issueNumber?: number
  issueDate?: string
}

export interface IssueMemoryWarning {
  level: 'likely_same_story' | 'related_topic'
  message: string
  matchedTitle: string
  issueNumber?: number
  issueDate?: string
  sharedSignals?: string[]
  similarity: number
}

const ENTITY_TERMS = new Set([
  'openai',
  'anthropic',
  'claude',
  'chatgpt',
  'google',
  'gemini',
  'microsoft',
  'copilot',
  'meta',
  'llama',
  'nvidia',
  'apple',
  'amazon',
  'aws',
  'xai',
  'grok',
  'mistral',
  'perplexity',
  'ottawa',
  'canada',
  'canadian',
  'federal',
  'treasury',
  'privacy',
  'commissioner',
  'regulator',
  'regulation',
  'procurement',
  'sovereign',
  'datacentre',
  'data',
  'residency',
])

const WEAK_TERMS = new Set([
  'announces',
  'announced',
  'launches',
  'launch',
  'new',
  'latest',
  'update',
  'updates',
  'report',
  'study',
  'research',
  'model',
  'models',
  'tool',
  'tools',
  'platform',
  'system',
  'systems',
])

function normalizedTokens(title: string): string[] {
  return title
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(token => token.length > 2 && !WEAK_TERMS.has(token))
}

function issueText(candidate: IssueMemoryCandidate) {
  return candidate.issueNumber && candidate.issueDate
    ? `Issue #${candidate.issueNumber} (${candidate.issueDate})`
    : 'a recent issue'
}

function sharedEntitySignals(a: string, b: string): string[] {
  const aTokens = new Set(normalizedTokens(a).filter(token => ENTITY_TERMS.has(token)))
  const bTokens = new Set(normalizedTokens(b).filter(token => ENTITY_TERMS.has(token)))
  return [...aTokens].filter(token => bTokens.has(token)).sort()
}

export function findIssueMemoryWarnings(
  title: string,
  candidates: IssueMemoryCandidate[],
): IssueMemoryWarning[] {
  const trimmedTitle = title.trim()
  if (!trimmedTitle) return []

  const warnings: IssueMemoryWarning[] = []
  const similar = findSimilarTitle(trimmedTitle, candidates, 0.6)
  if (similar) {
    warnings.push({
      level: 'likely_same_story',
      message: `Likely same story as ${issueText(similar)}: ${similar.title}`,
      matchedTitle: similar.title,
      issueNumber: similar.issueNumber,
      issueDate: similar.issueDate,
      sharedSignals: sharedEntitySignals(trimmedTitle, similar.title),
      similarity: titleSimilarity(trimmedTitle, similar.title),
    })
  }

  let bestRelated: IssueMemoryWarning | null = null
  for (const candidate of candidates) {
    if (similar && candidate.title === similar.title) continue
    const sharedSignals = sharedEntitySignals(trimmedTitle, candidate.title)
    if (sharedSignals.length < 2) continue

    const similarity = titleSimilarity(trimmedTitle, candidate.title)
    if (similarity < 0.35) continue

    const warning: IssueMemoryWarning = {
      level: 'related_topic',
      message: `Related topic signals already appeared in ${issueText(candidate)}: ${sharedSignals.join(', ')}`,
      matchedTitle: candidate.title,
      issueNumber: candidate.issueNumber,
      issueDate: candidate.issueDate,
      sharedSignals,
      similarity,
    }
    if (!bestRelated || warning.similarity > bestRelated.similarity) bestRelated = warning
  }

  if (bestRelated) warnings.push(bestRelated)
  return warnings
}
