import { describe, expect, it } from 'vitest'
import { categorize, categoryForArticle, isCanadaMention } from '@/lib/category-mapping'

describe('category mapping', () => {
  it('lets specific section intent beat broad Canadian framing', () => {
    expect(categorize('Google Alerts Daily Digest', 'Canadian AI Policy')).toBe('Policy & Regulation')
    expect(categorize('AI Research Papers', 'Canadian AI Research')).toBe('Research')
  })

  it('maps public sector and sovereign compute stories separately from generic industry', () => {
    expect(categorize('Daily News - AI', 'Sovereign AI & Compute')).toBe('Government & Public Sector')
    expect(categorize('Daily News - AI', 'Enterprise model releases')).toBe('Industry & Models')
  })

  it('maps applied sectors and research distinctly', () => {
    expect(categorize('Agriculture AI', 'AI and grain quality')).toBe('Sectors & Applications')
    expect(categorize('AI Research Papers', 'Research')).toBe('Research')
  })

  it('keeps Canadian stories in their stronger topical section when available', () => {
    expect(categoryForArticle({
      title: 'OpenAI privacy finding raises questions for Canadian schools',
      summary: 'The story links federal and provincial privacy expectations to AI tools.',
      category: 'Policy & Regulation',
    }, 'Policy & Regulation')).toBe('Policy & Regulation')
    expect(categoryForArticle({
      title: 'Ontario audit finds AI notetaker risk in medical clinics',
      summary: 'The story covers doctors, patients, and clinical AI deployment.',
      category: 'Canada',
    }, 'Canada')).toBe('Policy & Regulation')
    expect(categoryForArticle({
      title: 'Montreal firm backs AI data centre expansion',
      summary: 'The company is investing in compute infrastructure.',
      category: 'Canada',
    }, 'Canada')).toBe('Industry & Models')
  })

  it('uses Canada only when no stronger topic is present', () => {
    expect(isCanadaMention({ title: 'AI compute announcement', url: 'https://www.cbc.ca/news/example' })).toBe(true)
    expect(categoryForArticle({
      title: 'Canadian AI council releases a regional update',
      category: 'Canada',
    }, 'Canada')).toBe('Canada')
  })
})
