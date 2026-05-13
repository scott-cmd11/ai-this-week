import { describe, expect, it } from 'vitest'
import { areSimilarGoodNewsStories, dedupeGoodNewsStories } from '@/lib/good-news-dedupe'

describe('AI Good News dedupe', () => {
  it('dedupes exact canonical URLs', () => {
    const stories = dedupeGoodNewsStories([
      { title: 'AI helps weather forecasting', canonical_url: 'https://example.com/a?utm_source=x', source_url: 'https://example.com/a?utm_source=x' },
      { title: 'AI helps weather forecasting', canonical_url: 'https://example.com/a', source_url: 'https://example.com/a' },
    ])

    expect(stories).toHaveLength(1)
  })

  it('detects similar syndicated titles', () => {
    expect(areSimilarGoodNewsStories(
      { title: 'AI weather model helps improve regional forecasts', canonical_url: 'https://a.example/story', source_url: 'https://a.example/story' },
      { title: 'Regional forecasts improve with AI weather model', canonical_url: 'https://b.example/story', source_url: 'https://b.example/story' },
    )).toBe(true)
  })
})
