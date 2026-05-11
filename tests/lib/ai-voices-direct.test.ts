import { describe, expect, it } from 'vitest'
import { parseAiVoicesFeed, selectAiVoicesArticles, type AiVoicesSource } from '@/lib/ai-voices-direct'

const source: AiVoicesSource = {
  key: 'test',
  publication: 'Test AI Feed',
  primaryFeed: 'https://example.com/feed.xml',
  category: 'Industry & Models',
}

describe('AI voices direct feed parsing', () => {
  it('parses RSS items into article candidates with real titles', () => {
    const articles = parseAiVoicesFeed(source, `
      <rss><channel>
        <item>
          <title>Frontier models learn a new evaluation task</title>
          <link>https://example.com/model-eval?utm_source=test</link>
          <pubDate>Fri, 08 May 2026 12:00:00 +0000</pubDate>
          <description><![CDATA[Researchers describe a benchmark for model evaluation.]]></description>
        </item>
        <item>
          <title>https://example.com/archive</title>
          <link>https://example.com/archive</link>
        </item>
      </channel></rss>
    `)

    expect(articles).toHaveLength(1)
    expect(articles[0]).toMatchObject({
      title: 'Frontier models learn a new evaluation task',
      url: 'https://example.com/model-eval',
      summary: 'Researchers describe a benchmark for model evaluation.',
      publishedDate: '8 May 2026',
    })
  })

  it('parses Atom entries with alternate links', () => {
    const articles = parseAiVoicesFeed(source, `
      <feed xmlns="http://www.w3.org/2005/Atom">
        <entry>
          <title>AI agents reshape public-sector software work</title>
          <link rel="alternate" href="https://example.com/agents"/>
          <updated>2026-05-09T10:00:00Z</updated>
          <summary>New analysis of agents in government workflows.</summary>
        </entry>
      </feed>
    `)

    expect(articles[0]).toMatchObject({
      title: 'AI agents reshape public-sector software work',
      url: 'https://example.com/agents',
      publishedDate: '9 May 2026',
    })
  })

  it('selects recent high-signal articles and filters stale ones', () => {
    const selected = selectAiVoicesArticles([
      {
        title: 'AI safety benchmark update',
        url: 'https://example.com/safety',
        summary: 'Evaluation details',
        source: 'Test',
        publishedDate: '8 May 2026',
        category: 'Research',
        maxAgeDays: 14,
      },
      {
        title: 'Old model note',
        url: 'https://example.com/old',
        summary: 'Older item',
        source: 'Test',
        publishedDate: '1 Apr 2026',
        category: 'Industry & Models',
        maxAgeDays: 7,
      },
    ], '2026-05-10')

    expect(selected.map(article => article.title)).toEqual(['AI safety benchmark update'])
  })
})
