import { describe, expect, it } from 'vitest'
import { categorize, categoryForArticle, isCanadaMention } from '@/lib/category-mapping'

describe('category mapping', () => {
  it('keeps Canadian policy stories in the Canada section first', () => {
    expect(categorize('Google Alerts Daily Digest', 'Canadian AI Policy')).toBe('Canada')
  })

  it('maps public sector and sovereign compute stories separately from generic industry', () => {
    expect(categorize('Daily News - AI', 'Sovereign AI & Compute')).toBe('Government & Public Sector')
    expect(categorize('Daily News - AI', 'Enterprise model releases')).toBe('Industry & Models')
  })

  it('maps applied sectors and research distinctly', () => {
    expect(categorize('Agriculture AI', 'AI and grain quality')).toBe('Sectors & Applications')
    expect(categorize('AI Research Papers', 'Research')).toBe('Research')
  })

  it('moves any article with Canadian content into Canada even if the source section is generic', () => {
    expect(categoryForArticle({
      title: 'OpenAI privacy finding raises questions for Canadian schools',
      summary: 'The story links federal and provincial privacy expectations to AI tools.',
      category: 'Policy & Regulation',
    }, 'Policy & Regulation')).toBe('Canada')
  })

  it('treats Canadian domains and local place names as Canada mentions', () => {
    expect(isCanadaMention({ title: 'AI compute announcement', url: 'https://www.cbc.ca/news/example' })).toBe(true)
    expect(categoryForArticle({
      title: 'New model deployment expands in Vancouver',
      category: 'Industry & Models',
    }, 'Industry & Models')).toBe('Canada')
  })
})
