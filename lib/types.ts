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

export interface NotionBlock {
  id: string
  type: BlockType
  content: string
  href?: string          // Only present on bookmark blocks
}
