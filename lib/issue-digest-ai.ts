import type OpenAI from 'openai'
import type { Issue, NotionBlock } from './types'
import { deriveIssueDigest, extractIssueArticles, type IssueDigest } from './issue-summary'

interface GeneratedDigest {
  summary?: unknown
  keyDevelopments?: unknown
}

export async function generateIssueDigest(
  openai: OpenAI,
  blocks: NotionBlock[],
  issue?: Pick<Issue, 'issueNumber' | 'issueDate'>,
): Promise<IssueDigest> {
  const fallback = deriveIssueDigest(blocks, issue)
  const articles = extractIssueArticles(blocks).slice(0, 18)
  if (articles.length === 0) return fallback

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      max_tokens: 450,
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content: [
            'You write the front-page hook for AI Today, a plain-English Canadian AI briefing.',
            'Write like an editor at a serious newspaper: specific, direct, and interesting.',
            'Do not hype. Do not use marketing language. Do not invent facts.',
            'Return only valid JSON with this shape:',
            '{"summary":"two sentences, 45-80 words total","keyDevelopments":["three concise factual bullets"]}',
          ].join('\n'),
        },
        {
          role: 'user',
          content: [
            `Issue: ${issue?.issueNumber ? `Issue ${issue.issueNumber}` : 'latest issue'}${issue?.issueDate ? `, ${issue.issueDate}` : ''}`,
            '',
            'Write a hook that captures the main theme and makes a professional reader want to open the issue.',
            'Use the article summaries below as the only source material.',
            '',
            ...articles.map((article, index) =>
              [
                `${index + 1}. ${article.section || 'Unsectioned'} - ${article.title}`,
                article.summary ? `Summary: ${article.summary}` : null,
              ].filter(Boolean).join('\n'),
            ),
          ].join('\n'),
        },
      ],
    })

    const content = response.choices[0]?.message?.content?.trim()
    if (!content) return fallback

    const parsed = JSON.parse(content) as GeneratedDigest
    const summary = typeof parsed.summary === 'string' ? cleanGeneratedText(parsed.summary, 520) : ''
    const keyDevelopments = Array.isArray(parsed.keyDevelopments)
      ? parsed.keyDevelopments
        .filter((item): item is string => typeof item === 'string')
        .map(item => cleanGeneratedText(item, 180))
        .filter(Boolean)
        .slice(0, 3)
      : []

    return {
      ...fallback,
      summary: summary || fallback.summary,
      keyDevelopments: keyDevelopments.length > 0 ? keyDevelopments : fallback.keyDevelopments,
    }
  } catch {
    return fallback
  }
}

function cleanGeneratedText(text: string, maxLength: number) {
  const cleaned = text.replace(/\s+/g, ' ').trim()
  if (cleaned.length <= maxLength) return cleaned
  const clipped = cleaned.slice(0, maxLength - 1)
  const lastSpace = clipped.lastIndexOf(' ')
  return `${clipped.slice(0, Math.max(lastSpace, 40)).trim()}...`
}
