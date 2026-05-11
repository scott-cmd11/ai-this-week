import type { Issue, NotionBlock } from './types'

export interface IssueDigestArticle {
  section: string
  title: string
  summary: string
}

export interface IssueDigest {
  summary: string
  keyDevelopments: string[]
  storyCount: number
  sectionCount: number
  sections: string[]
  topics: string[]
}

interface TopicSignal {
  id: string
  label: string
  pattern: RegExp
}

const TOPIC_SIGNALS: TopicSignal[] = [
  {
    id: 'governance',
    label: 'AI governance',
    pattern: /\b(governance|regulat|policy|constitutional|accountability|oversight|privacy|law|safety)\b/i,
  },
  {
    id: 'public-sector',
    label: 'public-sector AI',
    pattern: /\b(public[- ]sector|government|defen[cs]e|agency|department|procurement|minister|federal)\b/i,
  },
  {
    id: 'enterprise',
    label: 'enterprise AI services',
    pattern: /\b(enterprise|services|joint venture|application|industry|startup|platform|business)\b/i,
  },
  {
    id: 'models',
    label: 'frontier models',
    pattern: /\b(frontier|model|models|openai|anthropic|gpt|llm|agents?)\b/i,
  },
  {
    id: 'evaluation',
    label: 'model evaluation',
    pattern: /\b(benchmark|evaluation|evaluat|metr|epoch|testing|risk|measurement|reliability)\b/i,
  },
  {
    id: 'research',
    label: 'AI research',
    pattern: /\b(research|scientific|chemists|molecules|automated r&d|laboratory|paper|study)\b/i,
  },
  {
    id: 'canada',
    label: 'Canadian AI',
    pattern: /\b(canada|canadian|ottawa|manitoba|winnipeg|toronto|montreal|vancouver)\b/i,
  },
]

const GENERIC_SECTIONS = new Set(['upcoming', 'events'])

export function deriveIssueSummary(
  blocks: NotionBlock[],
  issue?: Pick<Issue, 'issueNumber'>,
): string {
  return deriveIssueDigest(blocks, issue).summary
}

export function deriveIssueDigest(
  blocks: NotionBlock[],
  issue?: Pick<Issue, 'issueNumber'>,
): IssueDigest {
  const articles = extractIssueArticles(blocks).filter(article => !isGenericSection(article.section))
  const sections = unique(
    articles
      .map(article => article.section.trim())
      .filter(Boolean),
  )
  const storyCount = articles.length

  if (storyCount === 0) {
    return {
      summary: '',
      keyDevelopments: [],
      storyCount: 0,
      sectionCount: sections.length,
      sections,
      topics: [],
    }
  }

  const topics = scoreTopics(articles)
  const keyDevelopments = deriveKeyDevelopments(articles)
  const issueLabel = issue?.issueNumber ? `Issue ${issue.issueNumber}` : 'This issue'
  const focus = formatList(topics.slice(0, 4).map(topic => topic.label))
  const hook = chooseHook(topics.map(topic => topic.id))
  const implication = chooseImplication(topics.map(topic => topic.id))

  const summary = focus
    ? `${hook} ${issueLabel} connects ${focus}, showing ${implication}`
    : `${hook} ${issueLabel} pulls together ${storyCount} AI stories, showing what changed and why it matters.`

  return {
    summary,
    keyDevelopments,
    storyCount,
    sectionCount: sections.length,
    sections,
    topics: topics.map(topic => topic.label),
  }
}

export function extractIssueArticles(blocks: NotionBlock[]): IssueDigestArticle[] {
  const articles: IssueDigestArticle[] = []
  let section = ''
  let current: IssueDigestArticle | null = null

  const flush = () => {
    if (!current?.title.trim()) return
    articles.push({
      section: current.section.trim(),
      title: current.title.trim(),
      summary: current.summary.trim(),
    })
  }

  for (const block of blocks) {
    if (block.type === 'heading_2') {
      flush()
      current = null
      section = block.content.trim()
      continue
    }

    if (block.type === 'heading_3') {
      flush()
      current = {
        section,
        title: block.content.trim(),
        summary: '',
      }
      continue
    }

    if (!current) continue

    if (block.type === 'divider') {
      flush()
      current = null
      continue
    }

    if (block.type !== 'paragraph') continue

    const text = cleanText(block.content)
    if (!text || isMetadataLine(text) || current.summary) continue
    current.summary = text
  }

  flush()
  return articles
}

function deriveKeyDevelopments(articles: IssueDigestArticle[]): string[] {
  const usedSections = new Set<string>()
  const ranked = [...articles].sort((a, b) => articleScore(b) - articleScore(a))
  const selected: string[] = []

  for (const article of ranked) {
    if (selected.length >= 3) break
    const sectionKey = article.section.toLowerCase()
    if (sectionKey && usedSections.has(sectionKey) && selected.length < 2) continue

    const development = chooseDevelopmentText(article)
    if (!development) continue

    selected.push(ensureSentence(shorten(development, 155)))
    if (sectionKey) usedSections.add(sectionKey)
  }

  return selected
}

function scoreTopics(articles: IssueDigestArticle[]) {
  const fullText = articles
    .map(article => `${article.section} ${article.title} ${article.summary}`)
    .join(' ')

  const ranked = TOPIC_SIGNALS
    .map(signal => {
      const matches = fullText.match(new RegExp(signal.pattern.source, 'gi'))
      return { ...signal, score: matches?.length ?? 0 }
    })
    .filter(signal => signal.score > 0)
    .sort((a, b) => b.score - a.score)

  const selectedIds = new Set(ranked.slice(0, 5).map(signal => signal.id))
  return TOPIC_SIGNALS
    .filter(signal => selectedIds.has(signal.id))
    .map(signal => ranked.find(candidate => candidate.id === signal.id)!)
}

function chooseHook(topicIds: string[]) {
  const has = (id: string) => topicIds.includes(id)

  if (has('governance') && (has('evaluation') || has('public-sector'))) {
    return 'AI is moving from capability claims into questions of oversight, measurement, and institutional use.'
  }
  if (has('canada') && has('governance')) {
    return 'Canada\'s AI story is becoming less about adoption alone and more about the rules around it.'
  }
  if (has('evaluation') && has('models')) {
    return 'The central story is trust: how AI systems are tested, measured, and put to work.'
  }
  if (has('research') && (has('models') || has('enterprise'))) {
    return 'This issue follows AI moving from research results into practical systems.'
  }
  if (has('enterprise') || has('public-sector')) {
    return 'AI is showing up in the places where institutions make real decisions.'
  }

  return 'The latest issue traces where AI is becoming more concrete.'
}

function chooseImplication(topicIds: string[]) {
  const has = (id: string) => topicIds.includes(id)

  if (has('governance') && has('evaluation')) {
    return 'where AI is becoming a question of trust, oversight, and practical use.'
  }
  if (has('public-sector') && has('enterprise')) {
    return 'how AI is moving into public and private institutions at the same time.'
  }
  if (has('research') && has('models')) {
    return 'where current systems are improving and where they still need sharper tests.'
  }
  if (has('canada')) {
    return 'how the Canadian AI file is shifting across policy, research, and adoption.'
  }

  return 'where the next practical questions are starting to emerge.'
}

function articleScore(article: IssueDigestArticle) {
  const text = `${article.section} ${article.title} ${article.summary}`
  const topicHits = TOPIC_SIGNALS.reduce((score, signal) => score + (signal.pattern.test(text) ? 1 : 0), 0)
  return topicHits + (article.summary ? 1 : 0) - (isWeakDevelopmentText(article.summary) ? 3 : 0)
}

function cleanText(text: string) {
  return text.replace(/\s+/g, ' ').trim()
}

function isGenericSection(section: string) {
  return GENERIC_SECTIONS.has(section.trim().toLowerCase())
}

function isMetadataLine(text: string) {
  return /^(published|when|where):/i.test(text) || /^https?:\/\//i.test(text)
}

function firstSentence(text: string) {
  const match = cleanText(text).match(/^(.+?[.!?])(\s|$)/)
  return match?.[1]?.trim() || cleanText(text)
}

function chooseDevelopmentText(article: IssueDigestArticle) {
  const summary = firstSentence(article.summary)
  if (summary && !isWeakDevelopmentText(summary)) return summary
  if (article.title && !isWeakDevelopmentText(article.title)) return article.title
  return ''
}

function isWeakDevelopmentText(text: string) {
  const lower = cleanText(text).toLowerCase()
  if (!lower) return true
  if (lower.split(/\s+/).length <= 3 && !hasActionVerb(lower)) return true
  return (
    lower.startsWith('welcome to ') ||
    lower.includes('newsletter about') ||
    lower.includes('subscribe to') ||
    lower === 'read more' ||
    lower === 'blog' ||
    lower === 'archive' ||
    /^https?:\/\//.test(lower)
  )
}

function hasActionVerb(text: string) {
  return /\b(adds?|announces?|approves?|blocks?|builds?|compares?|expands?|finds?|launches?|measures?|plans?|publishes?|releases?|reports?|reviews?|shows?|tests?|uses?|warns?)\b/i.test(text)
}

function shorten(text: string, maxLength: number) {
  if (text.length <= maxLength) return text
  const trimmed = text.slice(0, maxLength - 1)
  const lastSpace = trimmed.lastIndexOf(' ')
  return `${trimmed.slice(0, Math.max(lastSpace, 40)).trim()}...`
}

function ensureSentence(text: string) {
  return /[.!?]$/.test(text) ? text : `${text}.`
}

function unique(items: string[]) {
  return items.filter((item, index) => items.indexOf(item) === index)
}

function formatList(items: string[]) {
  if (items.length <= 1) return items[0] ?? ''
  if (items.length === 2) return `${items[0]} and ${items[1]}`
  return `${items.slice(0, -1).join(', ')}, and ${items[items.length - 1]}`
}
