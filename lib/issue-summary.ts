import type { Issue, NotionBlock } from './types'

const TOPIC_SIGNALS = [
  { label: 'AI governance', pattern: /\b(governance|regulat|policy|constitutional|accountability|oversight)\b/i },
  { label: 'public-sector AI', pattern: /\b(public[- ]sector|government|defen[cs]e|agency|department|procurement)\b/i },
  { label: 'enterprise AI services', pattern: /\b(enterprise|services|joint venture|application|industry|startup)\b/i },
  { label: 'frontier models', pattern: /\b(frontier|model|models|openai|anthropic|gpt|llm)\b/i },
  { label: 'benchmarks and evaluations', pattern: /\b(benchmark|evaluation|metr|epoch|testing|risk)\b/i },
  { label: 'AI research', pattern: /\b(research|scientific|chemists|molecules|automated r&d|laboratory)\b/i },
  { label: 'Canadian AI', pattern: /\b(canada|canadian|ottawa|manitoba|winnipeg|toronto|montreal|vancouver)\b/i },
]

const GENERIC_SECTIONS = new Set(['upcoming', 'events'])

export function deriveIssueSummary(
  blocks: NotionBlock[],
  issue?: Pick<Issue, 'issueNumber'>,
): string {
  const articleTitles = blocks
    .filter(block => block.type === 'heading_3')
    .map(block => block.content.trim())
    .filter(Boolean)

  if (articleTitles.length === 0) return ''

  const sections = blocks
    .filter(block => block.type === 'heading_2')
    .map(block => block.content.trim())
    .filter(section => section && !GENERIC_SECTIONS.has(section.toLowerCase()))
    .filter((section, index, allSections) => allSections.indexOf(section) === index)

  const textToScan = articleTitles.join(' ')
  const topics = TOPIC_SIGNALS
    .filter(signal => signal.pattern.test(textToScan))
    .map(signal => signal.label)

  const issueLabel = issue?.issueNumber ? `Issue ${issue.issueNumber}` : 'This issue'
  const storyLabel = `${articleTitles.length} ${articleTitles.length === 1 ? 'story' : 'stories'}`

  if (sections.length > 0 && topics.length > 0) {
    return `${issueLabel} tracks ${storyLabel} across ${formatList(sections.slice(0, 4))}, with signals on ${formatList(topics.slice(0, 4))}.`
  }

  if (topics.length > 0) {
    return `${issueLabel} tracks ${storyLabel} on ${formatList(topics.slice(0, 4))}.`
  }

  if (sections.length > 0) {
    return `${issueLabel} tracks ${storyLabel} across ${formatList(sections.slice(0, 4))}.`
  }

  return `${issueLabel} tracks ${storyLabel} from the current AI source desk.`
}

function formatList(items: string[]) {
  if (items.length <= 1) return items[0] ?? ''
  if (items.length === 2) return `${items[0]} and ${items[1]}`
  return `${items.slice(0, -1).join(', ')}, and ${items[items.length - 1]}`
}
