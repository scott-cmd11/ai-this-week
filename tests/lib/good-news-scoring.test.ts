import { describe, expect, it } from 'vitest'
import { scoreGoodNewsCandidate } from '@/lib/good-news-scoring'

describe('AI Good News scoring', () => {
  it('accepts beneficial, evidence-linked AI stories', () => {
    const score = scoreGoodNewsCandidate({
      title: 'Randomized trial uses AI to support breast cancer screening',
      source_name: 'Nature Medicine',
      source_url: 'https://www.nature.com/articles/s41591-024-03093-5',
      summary: 'A clinical trial reported measured screening results from an AI-assisted workflow.',
      content_text: 'Researchers report a randomized study with patient screening evidence.',
      published_at: '2026-05-12T12:00:00.000Z',
      category: 'Health',
    })

    expect(score.accepted).toBe(true)
    expect(score.category).toBe('Health')
    expect(score.credibility_score).toBeGreaterThanOrEqual(70)
    expect(score.positivity_score).toBeGreaterThanOrEqual(55)
  })

  it('rejects job-loss and stock-market framing', () => {
    const score = scoreGoodNewsCandidate({
      title: 'AI stock jumps after tool replaces workers',
      source_name: 'Market wire',
      source_url: 'https://example.com/stock',
      summary: 'The story focuses on shares, layoffs, and replacing workers.',
    })

    expect(score.accepted).toBe(false)
    expect(score.rejection_reasons.join(' ')).toMatch(/Excluded framing/)
  })

  it('accepts AI accessibility stories with practical human benefit', () => {
    const score = scoreGoodNewsCandidate({
      title: 'AI-powered captions help students follow classroom lessons',
      source_name: 'Microsoft Accessibility Blog',
      source_url: 'https://blogs.microsoft.com/accessibility/example',
      summary: 'A deployed assistive tool improves accessibility for students with hearing loss.',
      content_text: 'The accessibility team describes an implemented feature with inclusive design evidence.',
      published_at: '2026-05-12T12:00:00.000Z',
      category: 'Accessibility',
    })

    expect(score.accepted).toBe(true)
    expect(score.category).toBe('Accessibility')
    expect(score.evidence_notes).toMatch(/AI relevance signals/)
  })

  it('rejects broad positive stories when AI relevance is unclear', () => {
    const score = scoreGoodNewsCandidate({
      title: 'New accessibility guide helps local business owners',
      source_name: 'Digital Main Street',
      source_url: 'https://digitalmainstreet.ca/example',
      summary: 'The guide shares inclusive design practices for storefront websites.',
      published_at: '2026-05-12T12:00:00.000Z',
      category: 'Small Business',
    })

    expect(score.accepted).toBe(false)
    expect(score.rejection_reasons.join(' ')).toMatch(/No clear AI relevance signal/)
  })

  it('rejects mixed or negative AI-risk framing even when a source mentions research', () => {
    const score = scoreGoodNewsCandidate({
      title: 'Is your AI chatbot manipulating you?',
      source_name: 'Tech Xplore AI',
      source_url: 'https://techxplore.com/example',
      summary: 'Researchers warn that AI systems may manipulate users and reshape their opinions.',
      content_text: 'The article focuses on manipulation, user risk, and concern about AI systems.',
      published_at: '2026-05-13T12:00:00.000Z',
      category: 'Safety',
    })

    expect(score.accepted).toBe(false)
    expect(score.rejection_reasons.join(' ')).toMatch(/misinformation or manipulation framing/)
  })

  it('rejects regulation and compliance how-to stories as weak good news', () => {
    const score = scoreGoodNewsCandidate({
      title: 'Navigating EU AI Act requirements for LLM fine-tuning',
      source_name: 'AWS Machine Learning Blog',
      source_url: 'https://aws.amazon.com/blogs/machine-learning/example',
      summary: 'The post shows how to track FLOPs and generate audit-ready documentation for compliance status.',
      content_text: 'This is a vendor how-to about EU AI Act compliance, fine-tuning, and audit-ready documentation.',
      published_at: '2026-05-13T12:00:00.000Z',
      category: 'Work',
    })

    expect(score.accepted).toBe(false)
    expect(score.rejection_reasons.join(' ')).toMatch(/regulation or compliance fight/)
  })

  it('rejects generic AI research without a clear human-benefit outcome', () => {
    const score = scoreGoodNewsCandidate({
      title: 'AI agents can do amazing things while knowing nothing',
      source_name: 'Tech Xplore AI',
      source_url: 'https://techxplore.com/example-agents',
      summary: 'A research paper explores AI agent behavior in laboratory tasks.',
      content_text: 'Researchers study AI agents and describe their behavior in benchmark tasks.',
      published_at: '2026-05-13T12:00:00.000Z',
      category: 'Science',
    })

    expect(score.accepted).toBe(false)
    expect(score.rejection_reasons.join(' ')).toMatch(/No clear positive good-news impact signal/)
  })

  it('accepts public-good AI with concrete safety benefit and evidence', () => {
    const score = scoreGoodNewsCandidate({
      title: 'AI model helps city engineers detect bridge cracks earlier',
      source_name: 'University engineering lab',
      source_url: 'https://example.edu/ai-bridge-cracks',
      summary: 'A university pilot used computer vision to detect infrastructure cracks earlier and support safer bridge inspections.',
      content_text: 'The study reports measured detection results from a named university lab and a city public works pilot.',
      published_at: '2026-05-13T12:00:00.000Z',
      category: 'Public Good',
    })

    expect(score.accepted).toBe(true)
    expect(score.category).toBe('Public Good')
    expect(score.evidence_notes).toMatch(/Positive impact signals/)
  })

  it('accepts serious public-benefit AI stories that include ordinary caveats', () => {
    const score = scoreGoodNewsCandidate({
      title: 'AI tool helps public health teams improve patient screening access',
      source_name: 'Reuters',
      source_url: 'https://www.reuters.com/example-health-ai',
      summary: 'A named public health pilot used artificial intelligence to improve patient screening access, while the article notes normal concerns about bias and job displacement that require oversight.',
      content_text: 'The deployment reports measured patient screening support from a named public health agency and describes safeguards for clinical staff.',
      published_at: '2026-05-14T12:00:00.000Z',
      category: 'Health',
    })

    expect(score.accepted).toBe(true)
    expect(score.rejection_reasons).toHaveLength(0)
  })

  it('accepts public-interest AI partnerships when the benefit is concrete', () => {
    const score = scoreGoodNewsCandidate({
      title: 'Anthropic, Gates Foundation launch $200 million partnership for AI in health, education',
      source_name: 'Reuters',
      source_url: 'https://news.google.com/rss/articles/example',
      summary: 'The initiative commits AI technical support and grant funding for health, education, African-language data, teacher support, and medical research.',
      content_text: 'Named organizations describe a four-year program using artificial intelligence to support teachers, patients, language access, and drug-candidate research.',
      published_at: '2026-05-14T18:03:51.000Z',
      category: 'Public Good',
    })

    expect(score.accepted).toBe(true)
    expect(score.category).toBe('Public Good')
  })
})
