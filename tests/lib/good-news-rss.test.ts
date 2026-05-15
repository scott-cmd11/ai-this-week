import { describe, expect, it } from 'vitest'
import { parseRssItems } from '@/lib/good-news-rss'

describe('AI Good News RSS parsing', () => {
  it('preserves original publisher signals from discovery feeds', () => {
    const items = parseRssItems(`
      <rss>
        <channel>
          <item>
            <title>Anthropic, Gates Foundation launch $200 million partnership for AI in health, education - Reuters</title>
            <link>https://news.google.com/rss/articles/example?oc=5</link>
            <pubDate>Thu, 14 May 2026 18:03:51 GMT</pubDate>
            <description><![CDATA[<a href="https://news.google.com/rss/articles/example">Anthropic, Gates Foundation launch $200 million partnership for AI in health, education</a>&nbsp;&nbsp;<font color="#6f6f6f">Reuters</font>]]></description>
            <source url="https://www.reuters.com">Reuters</source>
          </item>
        </channel>
      </rss>
    `)

    expect(items).toHaveLength(1)
    expect(items[0]).toMatchObject({
      title: 'Anthropic, Gates Foundation launch $200 million partnership for AI in health, education',
      link: 'https://news.google.com/rss/articles/example?oc=5',
      sourceName: 'Reuters',
      sourceUrl: 'https://www.reuters.com',
      publishedAt: '2026-05-14T18:03:51.000Z',
    })
  })
})
