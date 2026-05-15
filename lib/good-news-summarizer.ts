import type { GoodNewsCandidateInput, GoodNewsStory } from './good-news-types'
import { scoreGoodNewsCandidate } from './good-news-scoring'
import OpenAI from 'openai'

const GOOD_NEWS_CATEGORY_VALUES: GoodNewsStory['category'][] = [
  'Health',
  'Education',
  'Accessibility',
  'Science',
  'Climate',
  'Work',
  'Creativity',
  'Safety',
  'Public Good',
  'Small Business',
]

export interface GoodNewsSummaryResult {
  summary: string
  why_it_matters: string
  category: GoodNewsStory['category']
  tags: string[]
  positivity_score: number
  credibility_score: number
  evidence_notes: string
  accepted: boolean
  rejection_reasons: string[]
}

export interface GoodNewsSummarizer {
  summarize(input: GoodNewsCandidateInput): Promise<GoodNewsSummaryResult>
}

export function createGoodNewsSummarizer(): GoodNewsSummarizer {
  const apiKey = process.env.OPENAI_API_KEY
  if (apiKey) return new OpenAIGoodNewsSummarizer(apiKey, new FallbackGoodNewsSummarizer())
  return new FallbackGoodNewsSummarizer()
}

class OpenAIGoodNewsSummarizer implements GoodNewsSummarizer {
  private readonly client: OpenAI

  constructor(
    apiKey: string,
    private readonly fallback: GoodNewsSummarizer,
  ) {
    this.client = new OpenAI({ apiKey })
  }

  async summarize(input: GoodNewsCandidateInput): Promise<GoodNewsSummaryResult> {
    const score = scoreGoodNewsCandidate(input)
    if (!score.accepted) {
      return this.fallback.summarize(input)
    }

    try {
      const response = await this.client.chat.completions.create({
        model: process.env.AI_GOOD_NEWS_OPENAI_MODEL || 'gpt-4o-mini',
        temperature: 0.2,
        max_tokens: 450,
        response_format: { type: 'json_object' },
        messages: [
          {
            role: 'system',
            content: [
              'You write for AI Good News, an optimistic but evidence-minded editorial product.',
              'Summarize only the concrete public or human benefit in the source material.',
              'Do not exaggerate, do not say AI solves a problem, and do not add claims not present in the source.',
              'Use calm language such as may help, is being used to, researchers report, or early results suggest.',
              'Return valid JSON only with keys: summary, why_it_matters, category, tags, evidence_notes.',
            ].join(' '),
          },
          {
            role: 'user',
            content: JSON.stringify({
              title: cleanText(input.title),
              source_name: cleanText(input.source_name),
              source_url: input.source_url,
              published_at: input.published_at,
              source_snippet: cleanSourceSnippet(input.summary, input.source_name),
              category_hint: score.category,
              deterministic_evidence_notes: score.evidence_notes,
              allowed_categories: GOOD_NEWS_CATEGORY_VALUES,
            }),
          },
        ],
      })

      const content = response.choices[0]?.message?.content
      const parsed = parseAiSummary(content)
      if (!parsed) return this.fallback.summarize(input)

      return {
        summary: enforceSentenceLimit(parsed.summary, 2) || (await this.fallback.summarize(input)).summary,
        why_it_matters: enforceSentenceLimit(parsed.why_it_matters, 1) || buildWhyItMatters(input, score.category),
        category: sanitizeCategory(parsed.category, score.category),
        tags: sanitizeTags(parsed.tags, score.tags),
        positivity_score: score.positivity_score,
        credibility_score: score.credibility_score,
        evidence_notes: cleanText(parsed.evidence_notes) || score.evidence_notes,
        accepted: true,
        rejection_reasons: [],
      }
    } catch {
      return this.fallback.summarize(input)
    }
  }
}

class FallbackGoodNewsSummarizer implements GoodNewsSummarizer {
  async summarize(input: GoodNewsCandidateInput): Promise<GoodNewsSummaryResult> {
    const score = scoreGoodNewsCandidate(input)
    const rawText = cleanSourceSnippet(input.summary || input.content_text || input.title, input.source_name)
    const sentences = splitSentences(rawText)
    const summary = [
      ensureTerminalPunctuation(sentences[0] || input.title.trim()),
      sentences[1] || cautiousSecondSentence(input),
    ].join(' ')

    return {
      summary,
      why_it_matters: buildWhyItMatters(input, score.category),
      category: score.category,
      tags: score.tags,
      positivity_score: score.positivity_score,
      credibility_score: score.credibility_score,
      evidence_notes: score.evidence_notes,
      accepted: score.accepted,
      rejection_reasons: score.rejection_reasons,
    }
  }
}

function splitSentences(text: string): string[] {
  return text
    .replace(/\s+/g, ' ')
    .split(/(?<=[.!?])\s+/)
    .map(sentence => sentence.trim())
    .filter(Boolean)
    .slice(0, 2)
}

function cautiousSecondSentence(input: GoodNewsCandidateInput): string {
  const source = input.source_name?.trim() || 'the source'
  return `${source} describes this as an early, evidence-linked example rather than a complete solution.`
}

function buildWhyItMatters(input: GoodNewsCandidateInput, category: GoodNewsStory['category']): string {
  const title = input.title.toLowerCase()
  if (category === 'Health') return 'This may help health teams target attention and resources when evidence is tested carefully.'
  if (category === 'Education') return 'This may support teachers and learners when classroom outcomes and guardrails are measured.'
  if (category === 'Accessibility') return 'This shows AI being adapted to reduce everyday barriers for people with disabilities.'
  if (category === 'Climate') return 'This may help planners respond faster to energy, weather, or resilience challenges.'
  if (category === 'Small Business') return 'This may help smaller organizations get practical support without enterprise-sized teams.'
  if (title.includes('research') || category === 'Science') return 'This may accelerate research by making useful tools or evidence easier to access.'
  return 'This is a grounded example of AI being used for a practical human benefit.'
}

function parseAiSummary(content: string | null | undefined): {
  summary?: unknown
  why_it_matters?: unknown
  category?: unknown
  tags?: unknown
  evidence_notes?: unknown
} | null {
  if (!content) return null
  try {
    const parsed: unknown = JSON.parse(content)
    return parsed && typeof parsed === 'object' ? parsed : null
  } catch {
    return null
  }
}

function sanitizeCategory(value: unknown, fallback: GoodNewsStory['category']): GoodNewsStory['category'] {
  return typeof value === 'string' && GOOD_NEWS_CATEGORY_VALUES.includes(value as GoodNewsStory['category'])
    ? value as GoodNewsStory['category']
    : fallback
}

function sanitizeTags(value: unknown, fallback: string[]): string[] {
  const source = Array.isArray(value) ? value : fallback
  return source
    .filter((tag): tag is string => typeof tag === 'string')
    .map(tag => cleanText(tag).toLowerCase())
    .filter(Boolean)
    .filter((tag, index, tags) => tags.indexOf(tag) === index)
    .slice(0, 5)
}

function enforceSentenceLimit(value: unknown, limit: number): string {
  if (typeof value !== 'string') return ''
  return splitSentences(cleanText(value)).slice(0, limit).join(' ')
}

function cleanSourceSnippet(value: string | null | undefined, sourceName: string | null | undefined): string {
  const source = cleanText(sourceName)
  let text = cleanText(value)
  if (source) {
    const escapedSource = source.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    text = text
      .replace(new RegExp(`\\s+${escapedSource}\\s*$`, 'i'), '')
      .replace(new RegExp(`\\s+-\\s+${escapedSource}\\s*$`, 'i'), '')
  }
  return text
}

function ensureTerminalPunctuation(value: string): string {
  const cleaned = cleanText(value)
  return /[.!?]$/.test(cleaned) ? cleaned : `${cleaned}.`
}

function cleanText(value: unknown): string {
  return (typeof value === 'string' ? value : '')
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCharCode(parseInt(code, 16)))
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/gi, "'")
    .replace(/\s+/g, ' ')
    .trim()
}
