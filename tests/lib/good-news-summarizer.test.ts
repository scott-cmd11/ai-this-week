import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createGoodNewsSummarizer } from '@/lib/good-news-summarizer'

const chatCreate = vi.hoisted(() => vi.fn())

vi.mock('openai', () => ({
  default: vi.fn().mockImplementation(function MockOpenAI() {
    return {
      chat: {
        completions: {
          create: chatCreate,
        },
      },
    }
  }),
}))

const originalOpenAiKey = process.env.OPENAI_API_KEY
const originalGoodNewsModel = process.env.AI_GOOD_NEWS_OPENAI_MODEL

describe('AI Good News summarizer', () => {
  beforeEach(() => {
    chatCreate.mockReset()
    delete process.env.AI_GOOD_NEWS_OPENAI_MODEL
  })

  afterEach(() => {
    if (originalOpenAiKey === undefined) {
      delete process.env.OPENAI_API_KEY
    } else {
      process.env.OPENAI_API_KEY = originalOpenAiKey
    }

    if (originalGoodNewsModel === undefined) {
      delete process.env.AI_GOOD_NEWS_OPENAI_MODEL
    } else {
      process.env.AI_GOOD_NEWS_OPENAI_MODEL = originalGoodNewsModel
    }
  })

  it('uses the existing OpenAI key for accepted good-news stories', async () => {
    process.env.OPENAI_API_KEY = 'test-key'
    chatCreate.mockResolvedValue({
      choices: [
        {
          message: {
            content: JSON.stringify({
              summary: 'Xcel Energy is using AI-driven cameras to help detect wildfire smoke earlier in Wisconsin. The system is positioned as an early-warning tool for faster emergency response.',
              why_it_matters: 'Earlier detection may help crews respond faster when wildfire risk rises.',
              category: 'Climate',
              tags: ['wildfire detection', 'public safety', 'energy'],
              evidence_notes: 'The story comes from the utility newsroom and describes a named deployment of AI-enabled wildfire cameras.',
            }),
          },
        },
      ],
    })

    const summarizer = createGoodNewsSummarizer()
    const result = await summarizer.summarize({
      title: 'Xcel Energy brings AI-driven wildfire detection to Wisconsin',
      source_name: 'Xcel Energy Newsroom',
      source_url: 'https://xcelenergy.com/example-wildfire-ai',
      summary: 'Xcel Energy brings AI-driven wildfire detection to Wisconsin &nbsp;&nbsp; Xcel Energy Newsroom',
      content_text: 'The utility deployed AI-driven wildfire detection cameras to support earlier warnings and safer emergency response.',
      published_at: '2026-05-14T16:04:36.000Z',
      category: 'Climate',
    })

    expect(chatCreate).toHaveBeenCalledTimes(1)
    expect(result.summary).toMatch(/using AI-driven cameras/)
    expect(result.summary).not.toContain('&nbsp;')
    expect(result.why_it_matters).toMatch(/Earlier detection/)
    expect(result.positivity_score).toBeGreaterThanOrEqual(70)
    expect(result.credibility_score).toBeGreaterThanOrEqual(70)
  })

  it('keeps a clean deterministic fallback when no OpenAI key is configured', async () => {
    delete process.env.OPENAI_API_KEY

    const summarizer = createGoodNewsSummarizer()
    const result = await summarizer.summarize({
      title: 'Xcel Energy brings AI-driven wildfire detection to Wisconsin',
      source_name: 'Xcel Energy Newsroom',
      source_url: 'https://xcelenergy.com/example-wildfire-ai',
      summary: 'Xcel Energy brings AI-driven wildfire detection to Wisconsin &nbsp;&nbsp; Xcel Energy Newsroom',
      content_text: 'The utility deployed AI-driven wildfire detection cameras to support earlier warnings and safer emergency response.',
      published_at: '2026-05-14T16:04:36.000Z',
      category: 'Climate',
    })

    expect(chatCreate).not.toHaveBeenCalled()
    expect(result.summary).not.toContain('&nbsp;')
    expect(result.summary).not.toContain('Wisconsin Xcel Energy Newsroom')
  })
})
