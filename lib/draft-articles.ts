export interface DailyArticle {
  title: string | null
  annotation: string | null
  url: string | null
  imageUrl: string | null
  annotationBlockId: string | null
  category: string | null
}

function richTextPlainText(richText: Array<{ plain_text?: string }> | undefined): string {
  return (richText ?? []).map(r => r.plain_text ?? '').join('')
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function parseDailyArticles(blocks: any[]): DailyArticle[] {
  const articles: DailyArticle[] = []
  let current: DailyArticle | null = null
  let currentCategory: string | null = null

  for (const b of blocks) {
    const type: string = b.type

    if (type === 'heading_2') {
      if (current) {
        articles.push(current)
        current = null
      }
      const text = (b.content ?? richTextPlainText(b.heading_2?.rich_text)).trim()
      currentCategory = text || null
    } else if (type === 'heading_3') {
      if (current) articles.push(current)
      const text = b.content ?? richTextPlainText(b.heading_3?.rich_text)
      current = {
        title: text,
        annotation: null,
        url: null,
        imageUrl: null,
        annotationBlockId: null,
        category: currentCategory,
      }
    } else if (type === 'paragraph' && current) {
      const text = b.content ?? richTextPlainText(b.paragraph?.rich_text)
      if (text && !text.startsWith('Published:')) {
        current.annotation = text
        current.annotationBlockId = b.id ?? null
      }
    } else if (type === 'bookmark' && current) {
      current.url = b.href ?? b.bookmark?.url ?? null
    } else if (type === 'image' && current) {
      current.imageUrl = b.href ?? b.image?.external?.url ?? b.image?.file?.url ?? null
    } else if (type === 'divider') {
      if (current) {
        articles.push(current)
        current = null
      }
    }
  }

  if (current) articles.push(current)
  return articles
}
