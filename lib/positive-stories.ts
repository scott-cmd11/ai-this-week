import type { Issue, NotionBlock } from './types'

export interface PositiveStory {
  id: string
  title: string
  summary: string
  section: string
  sourceUrl: string | null
  sourceLabel: string
  publishedDate: string | null
  issueNumber: number
  issueDate: string
  issueTitle: string
  issueSlug: string
  themes: string[]
}

interface IssueWithBlocks extends Issue {
  blocks: NotionBlock[]
}

interface ParsedStory {
  id: string
  title: string
  summary: string
  section: string
  sourceUrl: string | null
  sourceLabel: string
  publishedDate: string | null
  issue: Issue
}

interface PositiveTheme {
  label: string
  signals: string[]
}

export const POSITIVE_AI_EDITORIAL_RULES = {
  allowedThemes: [
    'Health care',
    'Accessibility',
    'Education',
    'Science and research',
    'Productivity',
    'Climate and energy',
    'Public service',
    'Small business',
    'Creative tools',
    'Canadian innovation',
    'Human benefit',
  ],
  excludedSignals: [
    'job loss',
    'layoffs',
    'displacement',
    'existential risk',
    'scams',
    'lawsuits',
    'bias',
    'misinformation',
    'surveillance',
    'military harm',
    'safety failures',
    'fear-driven framing',
  ],
} as const

const POSITIVE_THEMES: PositiveTheme[] = [
  {
    label: 'Health care',
    signals: ['health care', 'healthcare', 'medical', 'patient', 'clinic', 'hospital', 'doctor', 'nurse', 'diagnosis'],
  },
  {
    label: 'Accessibility',
    signals: ['accessibility', 'assistive', 'disability', 'disabled', 'inclusive', 'caption', 'speech aid'],
  },
  {
    label: 'Education',
    signals: ['education', 'school', 'student', 'teacher', 'classroom', 'learning', 'tutor', 'training'],
  },
  {
    label: 'Science and research',
    signals: ['research', 'science', 'scientific', 'discovery', 'benchmark', 'reliability', 'verify', 'evaluation'],
  },
  {
    label: 'Productivity',
    signals: ['productivity', 'workflow', 'workflows', 'assistant', 'assistants', 'multi-step work', 'automation', 'task systems'],
  },
  {
    label: 'Climate and energy',
    signals: ['climate', 'energy', 'emissions', 'grid', 'clean power', 'environment', 'sustainability'],
  },
  {
    label: 'Public service',
    signals: ['public service', 'service delivery', 'public teams', 'civic', 'municipal', 'public-sector adoption'],
  },
  {
    label: 'Small business',
    signals: ['small business', 'entrepreneur', 'local business', 'main street', 'sme', 'startup support'],
  },
  {
    label: 'Creative tools',
    signals: ['creative', 'creator', 'design', 'artist', 'music', 'video tool', 'writing tool'],
  },
  {
    label: 'Canadian innovation',
    signals: [
      'canadian innovation',
      'canadian organizations',
      'canadian company',
      'canadian companies',
      'canadian ai',
      'canada ai',
      'winnipeg',
      'manitoba',
      'vancouver',
      'toronto',
      'montreal',
    ],
  },
  {
    label: 'Human benefit',
    signals: ['helps people', 'human benefit', 'community', 'access', 'capacity', 'support', 'practical update'],
  },
]

const EXCLUDED_STORY_SIGNALS = [
  'job loss',
  'job losses',
  'job displacement',
  'jobs at risk',
  'cuts jobs',
  'eliminate jobs',
  'eliminates jobs',
  'replace workers',
  'replacing workers',
  'replaced workers',
  'layoff',
  'layoffs',
  'unemployment',
  'displacement',
  'replacement',
  'existential risk',
  'risk',
  'risks',
  'doom',
  'fear',
  'threat',
  'threatens',
  'harm',
  'harmful',
  'abuse',
  'scam',
  'scams',
  'fraud',
  'lawsuit',
  'lawsuits',
  'court',
  'sues',
  'sued',
  'bias',
  'discrimination',
  'misinformation',
  'disinformation',
  'deepfake',
  'surveillance',
  'privacy breach',
  'safety failure',
  'military',
  'defence',
  'defense',
  'weapon',
  'war',
  'crackdown',
  'ban',
  'probe',
  'investigation',
  'complaint',
]

export function getPositiveStoriesFromIssues(issues: IssueWithBlocks[]): PositiveStory[] {
  return issues
    .filter(issue => issue.published)
    .flatMap(issue => parseStoriesFromIssue(issue))
    .flatMap(story => {
      const themes = getPositiveThemes(story)
      if (themes.length === 0 || hasExcludedFraming(story)) return []
      return [{
        id: story.id,
        title: story.title,
        summary: story.summary,
        section: story.section,
        sourceUrl: story.sourceUrl,
        sourceLabel: story.sourceLabel,
        publishedDate: story.publishedDate,
        issueNumber: story.issue.issueNumber,
        issueDate: story.issue.issueDate,
        issueTitle: story.issue.title,
        issueSlug: story.issue.slug,
        themes,
      }]
    })
}

export function getPositiveThemes(story: Pick<ParsedStory, 'title' | 'summary' | 'section' | 'sourceUrl' | 'sourceLabel'>): string[] {
  const text = storySearchText(story)
  return POSITIVE_THEMES
    .filter(theme => theme.signals.some(signal => containsSignal(text, signal)))
    .map(theme => theme.label)
}

export function hasExcludedFraming(story: Pick<ParsedStory, 'title' | 'summary' | 'section' | 'sourceUrl' | 'sourceLabel'>): boolean {
  const text = storySearchText(story)
  return EXCLUDED_STORY_SIGNALS.some(signal => containsSignal(text, signal))
}

function parseStoriesFromIssue(issue: IssueWithBlocks): ParsedStory[] {
  const stories: ParsedStory[] = []
  let section = 'Briefing'
  let current: ParsedStory | null = null

  const flush = () => {
    if (current && current.title.trim()) {
      stories.push(current)
    }
    current = null
  }

  for (const block of issue.blocks) {
    if (block.type === 'heading_2') {
      flush()
      section = block.content.trim() || 'Briefing'
      continue
    }

    if (block.type === 'heading_3') {
      flush()
      current = {
        id: `${issue.id}:${block.id}`,
        title: block.content.trim(),
        summary: '',
        section,
        sourceUrl: null,
        sourceLabel: 'Source link needed',
        publishedDate: null,
        issue,
      }
      continue
    }

    if (!current) continue

    if (block.type === 'divider') {
      flush()
      continue
    }

    if (block.type === 'bookmark' && block.href) {
      current.sourceUrl = block.href
      current.sourceLabel = hostnameOf(block.href)
      continue
    }

    if (block.type !== 'paragraph') continue

    const content = block.content.trim()
    if (!content) continue

    const linkedUrl = block.richText?.find(segment => segment.href)?.href
    if (linkedUrl && isSourceParagraph(content, linkedUrl)) {
      current.sourceUrl = linkedUrl
      current.sourceLabel = hostnameOf(linkedUrl)
      continue
    }

    if (/^Published:/i.test(content)) {
      current.publishedDate = content.replace(/^Published:\s*/i, '').trim() || null
      continue
    }

    current.summary = current.summary ? `${current.summary}\n\n${content}` : content
  }

  flush()
  return stories
}

function storySearchText(story: Pick<ParsedStory, 'title' | 'summary' | 'section' | 'sourceUrl' | 'sourceLabel'>): string {
  return [
    story.title,
    story.summary,
    story.section,
    story.sourceUrl,
    story.sourceLabel,
  ].filter(Boolean).join(' ').toLowerCase()
}

function containsSignal(text: string, signal: string): boolean {
  const normalizedSignal = signal.toLowerCase()
  if (normalizedSignal.includes(' ') || normalizedSignal.includes('-')) {
    return text.includes(normalizedSignal)
  }

  return new RegExp(`\\b${escapeRegExp(normalizedSignal)}s?\\b`, 'i').test(text)
}

function isSourceParagraph(content: string, href: string): boolean {
  return content === href || /^https?:\/\//i.test(content)
}

function hostnameOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return url
  }
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
