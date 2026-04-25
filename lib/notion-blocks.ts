// ─── Notion block builder helpers ───────────────────────────────────────────────
// Shared between new-issue, capture, and any future write routes.

export function richText(content: string) {
  return [{ type: 'text' as const, text: { content } }]
}

export const block = {
  h2: (content: string) => ({
    object: 'block' as const,
    type: 'heading_2' as const,
    heading_2: { rich_text: richText(content) },
  }),
  h3: (content: string) => ({
    object: 'block' as const,
    type: 'heading_3' as const,
    heading_3: { rich_text: richText(content) },
  }),
  paragraph: (content: string) => ({
    object: 'block' as const,
    type: 'paragraph' as const,
    paragraph: { rich_text: richText(content) },
  }),
  bullet: (content: string) => ({
    object: 'block' as const,
    type: 'bulleted_list_item' as const,
    bulleted_list_item: { rich_text: richText(content) },
  }),
  divider: () => ({
    object: 'block' as const,
    type: 'divider' as const,
    divider: {},
  }),
  bookmark: (url: string) => ({
    object: 'block' as const,
    type: 'bookmark' as const,
    bookmark: { url, caption: [] as never[] },
  }),
  image: (imageUrl: string) => ({
    object: 'block' as const,
    type: 'image' as const,
    image: { type: 'external' as const, external: { url: imageUrl } },
  }),
}

// ─── Notion date helpers ─────────────────────────────────────────────────────────

export function formatIsoDate(iso: string): string {
  return new Date(iso + 'T12:00:00Z').toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  })
}

/** Returns today's date as YYYY-MM-DD (UTC) */
export function todayUtc(): string {
  return new Date().toISOString().split('T')[0]
}
