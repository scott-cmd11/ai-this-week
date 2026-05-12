import { describe, expect, it } from 'vitest'
import { categorize } from '@/lib/category-mapping'

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
})
