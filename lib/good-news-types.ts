export const GOOD_NEWS_CATEGORIES = [
  'Health',
  'Education',
  'Accessibility',
  'Science',
  'Climate',
  'Work',
  'Creativity',
  'Safety',
  'Public Good',
  'Small Business',
] as const

export type GoodNewsCategory = typeof GOOD_NEWS_CATEGORIES[number]

export const GOOD_NEWS_STATUSES = ['pending', 'approved', 'rejected', 'published'] as const

export type GoodNewsStatus = typeof GOOD_NEWS_STATUSES[number]

export interface GoodNewsStory {
  id: string
  title: string
  source_name: string
  source_url: string
  canonical_url: string
  published_at: string
  discovered_at: string
  summary: string
  why_it_matters: string
  category: GoodNewsCategory
  tags: string[]
  positivity_score: number
  credibility_score: number
  evidence_notes: string
  status: GoodNewsStatus
}

export interface GoodNewsCandidateInput {
  title: string
  source_name?: string | null
  source_url: string
  canonical_url?: string | null
  published_at?: string | null
  discovered_at?: string | null
  summary?: string | null
  content_text?: string | null
  category?: string | null
  tags?: string[] | null
}

export interface GoodNewsDigest {
  id: string
  date: string
  headline: string
  intro: string
  story_ids: string[]
  generated_at: string
}

export interface GoodNewsSourceConfig {
  name: string
  type: 'rss'
  url: string
  default_category?: GoodNewsCategory
  focus?: string[]
  discovery_query?: string
  enabled: boolean
}
