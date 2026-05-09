import { findSimilarTitle } from './title-dedupe'

export interface SubjectDedupeCandidate {
  title: string
  issueNumber?: number
  issueDate?: string
}

export type SubjectDedupeResult =
  | { duplicate: false }
  | {
      duplicate: true
      scope: 'recent_issue' | 'current_batch'
      title: string
      issueNumber?: number
      issueDate?: string
    }

export function findSubjectDuplicate(
  title: string,
  recentTitles: SubjectDedupeCandidate[],
  batchTitles: SubjectDedupeCandidate[],
): SubjectDedupeResult {
  const recent = findSimilarTitle(title, recentTitles)
  if (recent) {
    return {
      duplicate: true,
      scope: 'recent_issue',
      title: recent.title,
      issueNumber: recent.issueNumber,
      issueDate: recent.issueDate,
    }
  }

  const batch = findSimilarTitle(title, batchTitles)
  if (batch) {
    return {
      duplicate: true,
      scope: 'current_batch',
      title: batch.title,
      issueNumber: batch.issueNumber,
      issueDate: batch.issueDate,
    }
  }

  return { duplicate: false }
}

export function subjectDuplicateMessage(result: SubjectDedupeResult): string | null {
  if (!result.duplicate) return null

  if (result.scope === 'recent_issue') {
    const issue = result.issueNumber && result.issueDate
      ? `Issue #${result.issueNumber} (${result.issueDate})`
      : 'a recent issue'
    return `Similar subject already exists in ${issue}: ${result.title}`
  }

  return `Similar subject already selected in this import: ${result.title}`
}
