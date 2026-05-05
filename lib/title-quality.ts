const TRAILING_FRAGMENT_PATTERN =
  /\b(and|or|but|for|with|without|to|of|in|on|at|by|from|as|into|over|under|after|before)$/i

export interface TitleQualityWarning {
  code: 'trailing_fragment' | 'source_title_replaced'
  message: string
}

export function titleLooksTruncated(title: string | null | undefined): boolean {
  const normalized = title?.trim()
  if (!normalized) return true
  return TRAILING_FRAGMENT_PATTERN.test(normalized)
}

export function titleQualityWarnings(title: string | null | undefined): TitleQualityWarning[] {
  if (!titleLooksTruncated(title)) return []
  return [{
    code: 'trailing_fragment',
    message: 'Title may be cut off. It ends with a dangling word.',
  }]
}

export function chooseSourceTitle(
  importedTitle: string,
  sourceTitle: string | null,
): { title: string; warnings: TitleQualityWarning[] } {
  const fallbackTitle = importedTitle.trim()
  const canonicalTitle = sourceTitle?.trim()

  if (!canonicalTitle) {
    return { title: fallbackTitle, warnings: titleQualityWarnings(fallbackTitle) }
  }

  if (titleLooksTruncated(fallbackTitle) || canonicalTitle.length > fallbackTitle.length + 12) {
    return {
      title: canonicalTitle,
      warnings: [{
        code: 'source_title_replaced',
        message: 'Briefing title looked incomplete, so the source page title was used.',
      }],
    }
  }

  return { title: fallbackTitle, warnings: titleQualityWarnings(fallbackTitle) }
}
