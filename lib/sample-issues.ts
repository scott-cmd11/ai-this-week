import type { Issue, NotionBlock } from './types'

type SampleIssue = Issue & { blocks: NotionBlock[] }

function blockId(issueDate: string, suffix: string) {
  return `sample-${issueDate}-${suffix}`
}

function h2(issueDate: string, suffix: string, content: string): NotionBlock {
  return {
    id: blockId(issueDate, suffix),
    type: 'heading_2',
    content,
    headingId: content.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, ''),
  }
}

function h3(issueDate: string, suffix: string, content: string): NotionBlock {
  return { id: blockId(issueDate, suffix), type: 'heading_3', content }
}

function paragraph(issueDate: string, suffix: string, content: string): NotionBlock {
  return {
    id: blockId(issueDate, suffix),
    type: 'paragraph',
    content,
    richText: [{ text: content }],
  }
}

function bookmark(issueDate: string, suffix: string, href: string): NotionBlock {
  return { id: blockId(issueDate, suffix), type: 'bookmark', content: 'Read more', href }
}

function divider(issueDate: string, suffix: string): NotionBlock {
  return { id: blockId(issueDate, suffix), type: 'divider', content: '' }
}

export const SAMPLE_ISSUES: SampleIssue[] = [
  {
    id: 'sample-2026-05-12',
    title: 'AI Today - May 12, 2026',
    issueDate: '2026-05-12',
    issueNumber: 12,
    published: true,
    summary:
      'Canada-first policy signals, public-sector adoption, and research updates are grouped into a local demo issue for safe design and workflow QA.',
    aiAssisted: true,
    slug: '2026-05-12',
    blocks: [
      h2('2026-05-12', 'canada', 'Canada'),
      h3('2026-05-12', 'canada-title', 'Federal AI procurement guidance gets a practical update'),
      paragraph('2026-05-12', 'canada-date', 'Published: 2026-05-12'),
      paragraph(
        '2026-05-12',
        'canada-summary',
        'The update gives public teams clearer language for documenting AI risk, vendor accountability, and human review before procurement decisions move forward.',
      ),
      bookmark('2026-05-12', 'canada-source', 'https://www.canada.ca/'),
      divider('2026-05-12', 'canada-divider'),
      h2('2026-05-12', 'policy', 'Policy & Regulation'),
      h3('2026-05-12', 'policy-title', 'Privacy regulators press for stronger AI impact records'),
      paragraph('2026-05-12', 'policy-date', 'Published: 2026-05-12'),
      paragraph(
        '2026-05-12',
        'policy-summary',
        'The signal points to a wider compliance expectation: teams using AI should be able to show what data was used, what risks were reviewed, and who remains accountable.',
      ),
      bookmark('2026-05-12', 'policy-source', 'https://www.priv.gc.ca/'),
      divider('2026-05-12', 'policy-divider'),
      h2('2026-05-12', 'research', 'Research'),
      h3('2026-05-12', 'research-title', 'New benchmark work tests agent reliability on longer tasks'),
      paragraph('2026-05-12', 'research-date', 'Published: 2026-05-12'),
      paragraph(
        '2026-05-12',
        'research-summary',
        'The useful signal is not another leaderboard score; it is the continued shift toward evaluating whether systems can recover, verify, and finish multi-step work.',
      ),
      bookmark('2026-05-12', 'research-source', 'https://arxiv.org/'),
      divider('2026-05-12', 'research-divider'),
    ],
  },
  {
    id: 'sample-2026-05-11',
    title: 'AI Today - May 11, 2026',
    issueDate: '2026-05-11',
    issueNumber: 11,
    published: true,
    summary:
      'A compact sample archive issue covering Canadian regulation, model infrastructure, and applied AI signals for local route and layout checks.',
    aiAssisted: true,
    slug: '2026-05-11',
    blocks: [
      h2('2026-05-11', 'canada', 'Canada'),
      h3('2026-05-11', 'canada-title', 'Canadian AI infrastructure debate moves from concept to capacity'),
      paragraph('2026-05-11', 'canada-date', 'Published: 2026-05-11'),
      paragraph(
        '2026-05-11',
        'canada-summary',
        'The story is about operating capacity: where compute is built, who controls it, and how Canadian organizations can access it without losing strategic flexibility.',
      ),
      bookmark('2026-05-11', 'canada-source', 'https://ised-isde.canada.ca/'),
      divider('2026-05-11', 'canada-divider'),
      h2('2026-05-11', 'industry', 'Industry & Models'),
      h3('2026-05-11', 'industry-title', 'Enterprise AI tools keep shifting toward workflow agents'),
      paragraph('2026-05-11', 'industry-date', 'Published: 2026-05-11'),
      paragraph(
        '2026-05-11',
        'industry-summary',
        'The product pattern is consistent: assistants are becoming embedded task systems with permissions, context, and audit trails rather than standalone chat windows.',
      ),
      bookmark('2026-05-11', 'industry-source', 'https://openai.com/'),
      divider('2026-05-11', 'industry-divider'),
    ],
  },
]

export function shouldUseSampleIssues() {
  return process.env.NODE_ENV !== 'production' && process.env.AI_TODAY_DISABLE_SAMPLE_ISSUES !== '1'
}

function withoutBlocks(issue: SampleIssue): Issue {
  return {
    id: issue.id,
    title: issue.title,
    issueDate: issue.issueDate,
    issueNumber: issue.issueNumber,
    published: issue.published,
    summary: issue.summary,
    aiAssisted: issue.aiAssisted,
    slug: issue.slug,
  }
}

export function getSamplePublishedIssues(): Issue[] {
  return SAMPLE_ISSUES.map(withoutBlocks)
}

export function getSampleIssueByDate(date: string, publishedOnly = true): Issue | null {
  const issue = SAMPLE_ISSUES.find(candidate => candidate.issueDate === date)
  if (!issue || (publishedOnly && !issue.published)) return null
  return withoutBlocks(issue)
}

export function getSampleIssueBlocks(issueId: string): NotionBlock[] {
  return SAMPLE_ISSUES.find(issue => issue.id === issueId)?.blocks ?? []
}

export function listSampleIssues(): SampleIssue[] {
  return SAMPLE_ISSUES
}
