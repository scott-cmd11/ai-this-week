export interface Issue {
  id: string
  title: string
  issueDate: string      // YYYY-MM-DD, used as URL slug
  issueNumber: number
  published: boolean
  summary?: string
  aiAssisted: boolean
  slug: string           // same as issueDate
}

export type BlockType =
  | 'paragraph'
  | 'heading_2'
  | 'heading_3'
  | 'bulleted_list_item'
  | 'numbered_list_item'
  | 'bookmark'
  | 'divider'
  | 'image'

/** A single segment of rich text — may be plain, bold, linked, or both */
export interface RichTextSegment {
  text: string
  bold?: boolean
  href?: string | null
}

export interface NotionBlock {
  id: string
  type: BlockType
  content: string                  // plain-text fallback / heading text
  richText?: RichTextSegment[]     // populated for paragraphs with formatting or links
  href?: string                    // bookmark URL or image URL
  headingId?: string               // slug anchor for h2 headings (table of contents)
}
