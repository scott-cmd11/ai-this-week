import type { GoodNewsCandidateInput, GoodNewsStory } from './good-news-types'
import { scoreGoodNewsCandidate } from './good-news-scoring'

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
  return new MockGoodNewsSummarizer()
}

class MockGoodNewsSummarizer implements GoodNewsSummarizer {
  async summarize(input: GoodNewsCandidateInput): Promise<GoodNewsSummaryResult> {
    const score = scoreGoodNewsCandidate(input)
    const rawText = input.summary?.trim() || input.content_text?.trim() || input.title.trim()
    const sentences = splitSentences(rawText)
    const summary = [
      sentences[0] || input.title.trim(),
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
