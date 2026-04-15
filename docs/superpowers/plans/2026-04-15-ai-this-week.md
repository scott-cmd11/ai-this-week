# AI This Week Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a weekly AI newsletter website that pulls content from a Notion database and serves accessible, static HTML pages via Vercel.

**Architecture:** Next.js 15 App Router fetches published issues from a Notion database at build time, using ISR (`revalidate = 300`) so pages refresh within 5 minutes of a publish. All Notion access is isolated to `lib/notion.ts`. A custom block renderer in `lib/notion-renderer.tsx` converts Notion blocks to accessible semantic HTML.

**Tech Stack:** Next.js 15, TypeScript, Tailwind CSS, `@notionhq/client`, Vitest, @testing-library/react, Vercel

---

## File Map

```
app/
  layout.tsx                   # Root layout — skip link, header, footer, font metadata
  page.tsx                     # / — server redirect to latest issue
  about/
    page.tsx                   # /about — static AI disclosure page
  issues/
    page.tsx                   # /issues — archive index
    [date]/
      page.tsx                 # /issues/[date] — individual issue
  sitemap.ts                   # /sitemap.xml

components/
  Header.tsx                   # GOV.UK black header bar + nav
  Footer.tsx                   # Disclosure footer
  MetadataStrip.tsx            # Issue number, date display
  AIDisclosureBadge.tsx        # Inline warning banner (conditional)
  IssueCard.tsx                # Archive index card

lib/
  types.ts                     # Shared TypeScript types
  notion.ts                    # All Notion API access
  notion-renderer.tsx          # Custom block renderer

tests/
  lib/
    notion.test.ts             # Unit tests for Notion mappers
    notion-renderer.test.tsx   # Unit tests for block renderer

tailwind.config.ts             # GOV.UK colour/spacing tokens
app/globals.css                # Skip link, focus ring, base reset
.env.local                     # NOTION_TOKEN, NOTION_DATABASE_ID (not committed)
vitest.config.ts               # Test runner config
```

---

## Task 1: Project Scaffold

**Files:**
- Create: `package.json` (via create-next-app)
- Create: `tailwind.config.ts`
- Create: `vitest.config.ts`
- Create: `.env.local`
- Create: `.gitignore`

- [ ] **Step 1: Scaffold Next.js project**

```bash
cd "/Users/scotthazlitt/AI This Week"
npx create-next-app@latest . --typescript --tailwind --eslint --app --no-src-dir --import-alias "@/*" --yes
```

Expected: Next.js 15 project created with App Router, TypeScript, Tailwind, ESLint.

- [ ] **Step 2: Install additional dependencies**

```bash
npm install @notionhq/client
npm install --save-dev vitest @vitejs/plugin-react jsdom @testing-library/react @testing-library/jest-dom @testing-library/user-event
```

- [ ] **Step 3: Configure Vitest**

Create `vitest.config.ts`:

```typescript
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./tests/setup.ts'],
    globals: true,
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, '.'),
    },
  },
})
```

Create `tests/setup.ts`:

```typescript
import '@testing-library/jest-dom'
```

- [ ] **Step 4: Configure Tailwind with GOV.UK tokens**

First, check which Tailwind version was installed:

```bash
npm list tailwindcss
```

**If Tailwind v4** (likely with Next.js 15 — version `4.x`): add GOV.UK tokens as a `@theme` block inside `app/globals.css`, immediately after the `@import "tailwindcss"` line:

```css
@import "tailwindcss";

@theme {
  --color-govuk-black: #0b0c0c;
  --color-govuk-blue: #1d70b8;
  --color-govuk-yellow: #ffdd00;
  --color-govuk-light-grey: #f3f2f1;
  --color-govuk-mid-grey: #b1b4b6;
  --color-govuk-dark-grey: #505a5f;
}
```

In Tailwind v4, these map directly to utility classes like `text-govuk-black`, `bg-govuk-blue`, etc. — the same class names used throughout this plan. No `tailwind.config.ts` changes needed.

**If Tailwind v3** (version `3.x`): replace the contents of `tailwind.config.ts` with:

```typescript
import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './lib/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        'govuk-black': '#0b0c0c',
        'govuk-blue': '#1d70b8',
        'govuk-yellow': '#ffdd00',
        'govuk-light-grey': '#f3f2f1',
        'govuk-mid-grey': '#b1b4b6',
        'govuk-dark-grey': '#505a5f',
      },
    },
  },
  plugins: [],
}

export default config
```

And replace `app/globals.css` opening line with:

```css
@tailwind base;
@tailwind components;
@tailwind utilities;
```

- [ ] **Step 5: Add test script to package.json**

Open `package.json` and add to the `scripts` section:

```json
"test": "vitest run",
"test:watch": "vitest"
```

- [ ] **Step 6: Create .env.local template**

Create `.env.local`:

```bash
NOTION_TOKEN=your_notion_integration_token_here
NOTION_DATABASE_ID=your_notion_database_id_here
NEXT_PUBLIC_BASE_URL=http://localhost:3000
```

- [ ] **Step 7: Ensure .env.local is gitignored**

Open `.gitignore` and confirm `.env.local` is present. If not, add it:

```
.env.local
.env*.local
```

- [ ] **Step 8: Verify dev server starts**

```bash
npm run dev
```

Expected: Server starts on http://localhost:3000 with no errors.

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "chore: scaffold Next.js project with GOV.UK Tailwind tokens and Vitest"
```

---

## Task 2: TypeScript Types

**Files:**
- Create: `lib/types.ts`

- [ ] **Step 1: Create types file**

Create `lib/types.ts`:

```typescript
export interface Issue {
  id: string
  title: string
  issueDate: string      // YYYY-MM-DD, used as URL slug
  issueNumber: number
  published: boolean
  summary: string
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
```

- [ ] **Step 2: Commit**

```bash
git add lib/types.ts
git commit -m "feat: add shared TypeScript types"
```

---

## Task 3: Notion Data Layer

**Files:**
- Create: `lib/notion.ts`
- Create: `tests/lib/notion.test.ts`

- [ ] **Step 1: Create test directory**

```bash
mkdir -p tests/lib
```

- [ ] **Step 2: Write failing tests for mapping functions**

Create `tests/lib/notion.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { mapPageToIssue, mapBlockToNotionBlock } from '@/lib/notion'

describe('mapPageToIssue', () => {
  it('maps a Notion page to an Issue', () => {
    const fakePage = {
      id: 'page-123',
      properties: {
        Title: { title: [{ plain_text: 'AI This Week — Apr 14, 2026' }] },
        'Issue Date': { date: { start: '2026-04-14' } },
        'Issue Number': { number: 42 },
        Published: { checkbox: true },
        Summary: { rich_text: [{ plain_text: 'Weekly AI roundup.' }] },
        'AI Assisted': { checkbox: true },
      },
    }

    const issue = mapPageToIssue(fakePage)

    expect(issue).toEqual({
      id: 'page-123',
      title: 'AI This Week — Apr 14, 2026',
      issueDate: '2026-04-14',
      issueNumber: 42,
      published: true,
      summary: 'Weekly AI roundup.',
      aiAssisted: true,
      slug: '2026-04-14',
    })
  })

  it('handles missing optional fields gracefully', () => {
    const fakePage = {
      id: 'page-456',
      properties: {
        Title: { title: [] },
        'Issue Date': { date: null },
        'Issue Number': { number: null },
        Published: { checkbox: false },
        Summary: { rich_text: [] },
        'AI Assisted': { checkbox: false },
      },
    }

    const issue = mapPageToIssue(fakePage)

    expect(issue.title).toBe('')
    expect(issue.issueDate).toBe('')
    expect(issue.issueNumber).toBe(0)
    expect(issue.summary).toBe('')
  })
})

describe('mapBlockToNotionBlock', () => {
  it('maps a paragraph block', () => {
    const block = {
      id: 'block-1',
      type: 'paragraph',
      paragraph: { rich_text: [{ plain_text: 'Hello world' }] },
    }
    const result = mapBlockToNotionBlock(block)
    expect(result).toEqual({ id: 'block-1', type: 'paragraph', content: 'Hello world' })
  })

  it('maps a heading_2 block', () => {
    const block = {
      id: 'block-2',
      type: 'heading_2',
      heading_2: { rich_text: [{ plain_text: 'Bright Spot' }] },
    }
    const result = mapBlockToNotionBlock(block)
    expect(result).toEqual({ id: 'block-2', type: 'heading_2', content: 'Bright Spot' })
  })

  it('maps a bookmark block', () => {
    const block = {
      id: 'block-3',
      type: 'bookmark',
      bookmark: { url: 'https://example.com', caption: [{ plain_text: 'Read more' }] },
    }
    const result = mapBlockToNotionBlock(block)
    expect(result).toEqual({
      id: 'block-3',
      type: 'bookmark',
      content: 'Read more',
      href: 'https://example.com',
    })
  })

  it('maps a bookmark block with no caption to default text', () => {
    const block = {
      id: 'block-4',
      type: 'bookmark',
      bookmark: { url: 'https://example.com', caption: [] },
    }
    const result = mapBlockToNotionBlock(block)
    expect(result.content).toBe('Read more')
  })

  it('maps a divider block', () => {
    const block = { id: 'block-5', type: 'divider', divider: {} }
    const result = mapBlockToNotionBlock(block)
    expect(result).toEqual({ id: 'block-5', type: 'divider', content: '' })
  })

  it('maps an unknown block type to a paragraph with empty content', () => {
    const block = {
      id: 'block-6',
      type: 'unsupported_type',
      unsupported_type: { rich_text: [] },
    }
    const result = mapBlockToNotionBlock(block)
    expect(result.type).toBe('paragraph')
    expect(result.content).toBe('')
  })
})
```

- [ ] **Step 3: Run tests — expect failures**

```bash
npm test
```

Expected: FAIL — `mapPageToIssue` and `mapBlockToNotionBlock` are not defined.

- [ ] **Step 4: Implement lib/notion.ts**

Create `lib/notion.ts`:

```typescript
import { Client } from '@notionhq/client'
import type { Issue, NotionBlock, BlockType } from './types'

const notion = new Client({ auth: process.env.NOTION_TOKEN })
const DATABASE_ID = process.env.NOTION_DATABASE_ID!

// ─── Public API ───────────────────────────────────────────────────────────────

export async function getPublishedIssues(): Promise<Issue[]> {
  const response = await notion.databases.query({
    database_id: DATABASE_ID,
    filter: {
      property: 'Published',
      checkbox: { equals: true },
    },
    sorts: [{ property: 'Issue Date', direction: 'descending' }],
  })
  return response.results.map(mapPageToIssue)
}

export async function getLatestIssue(): Promise<Issue | null> {
  const issues = await getPublishedIssues()
  return issues[0] ?? null
}

export async function getIssueByDate(date: string): Promise<Issue | null> {
  const response = await notion.databases.query({
    database_id: DATABASE_ID,
    filter: {
      and: [
        { property: 'Published', checkbox: { equals: true } },
        { property: 'Issue Date', date: { equals: date } },
      ],
    },
  })
  if (response.results.length === 0) return null
  return mapPageToIssue(response.results[0])
}

export async function getIssueBlocks(pageId: string): Promise<NotionBlock[]> {
  const response = await notion.blocks.children.list({ block_id: pageId })
  return response.results.map(mapBlockToNotionBlock)
}

// ─── Mappers (exported for testing) ──────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function mapPageToIssue(page: any): Issue {
  const props = page.properties
  const issueDate: string = props['Issue Date'].date?.start ?? ''
  return {
    id: page.id,
    title: props.Title.title[0]?.plain_text ?? '',
    issueDate,
    issueNumber: props['Issue Number'].number ?? 0,
    published: props.Published.checkbox,
    summary: props.Summary.rich_text[0]?.plain_text ?? '',
    aiAssisted: props['AI Assisted'].checkbox,
    slug: issueDate,
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function mapBlockToNotionBlock(block: any): NotionBlock {
  const type: string = block.type
  const content = block[type]

  const richTextToString = (richText: any[]): string =>
    (richText ?? []).map((t: any) => t.plain_text).join('')

  switch (type) {
    case 'paragraph':
      return { id: block.id, type: 'paragraph', content: richTextToString(content.rich_text) }
    case 'heading_2':
      return { id: block.id, type: 'heading_2', content: richTextToString(content.rich_text) }
    case 'heading_3':
      return { id: block.id, type: 'heading_3', content: richTextToString(content.rich_text) }
    case 'bulleted_list_item':
      return { id: block.id, type: 'bulleted_list_item', content: richTextToString(content.rich_text) }
    case 'numbered_list_item':
      return { id: block.id, type: 'numbered_list_item', content: richTextToString(content.rich_text) }
    case 'bookmark':
      return {
        id: block.id,
        type: 'bookmark',
        content: content.caption?.[0]?.plain_text ?? 'Read more',
        href: content.url,
      }
    case 'divider':
      return { id: block.id, type: 'divider', content: '' }
    default:
      return { id: block.id, type: 'paragraph', content: richTextToString(content?.rich_text ?? []) }
  }
}
```

- [ ] **Step 5: Run tests — expect all pass**

```bash
npm test
```

Expected: All tests PASS.

- [ ] **Step 6: Commit**

```bash
git add lib/notion.ts tests/lib/notion.test.ts tests/setup.ts vitest.config.ts
git commit -m "feat: add Notion data layer with unit tests"
```

---

## Task 4: Custom Block Renderer

**Files:**
- Create: `lib/notion-renderer.tsx`
- Create: `tests/lib/notion-renderer.test.tsx`

- [ ] **Step 1: Write failing tests for the renderer**

Create `tests/lib/notion-renderer.test.tsx`:

```typescript
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { NotionRenderer } from '@/lib/notion-renderer'
import type { NotionBlock } from '@/lib/types'

describe('NotionRenderer', () => {
  it('renders a paragraph block', () => {
    const blocks: NotionBlock[] = [
      { id: '1', type: 'paragraph', content: 'Hello world' },
    ]
    render(<NotionRenderer blocks={blocks} />)
    expect(screen.getByText('Hello world').tagName).toBe('P')
  })

  it('renders a heading_2 block as h2', () => {
    const blocks: NotionBlock[] = [
      { id: '2', type: 'heading_2', content: 'Section Title' },
    ]
    render(<NotionRenderer blocks={blocks} />)
    expect(screen.getByRole('heading', { level: 2, name: 'Section Title' })).toBeInTheDocument()
  })

  it('renders bulleted list items as a ul > li structure', () => {
    const blocks: NotionBlock[] = [
      { id: '3', type: 'bulleted_list_item', content: 'First item' },
      { id: '4', type: 'bulleted_list_item', content: 'Second item' },
    ]
    render(<NotionRenderer blocks={blocks} />)
    const list = screen.getByRole('list')
    expect(list.tagName).toBe('UL')
    expect(screen.getAllByRole('listitem')).toHaveLength(2)
  })

  it('groups consecutive bulleted list items into one ul', () => {
    const blocks: NotionBlock[] = [
      { id: '5', type: 'bulleted_list_item', content: 'Item A' },
      { id: '6', type: 'bulleted_list_item', content: 'Item B' },
      { id: '7', type: 'paragraph', content: 'After the list' },
      { id: '8', type: 'bulleted_list_item', content: 'Item C' },
    ]
    render(<NotionRenderer blocks={blocks} />)
    expect(screen.getAllByRole('list')).toHaveLength(2)
  })

  it('renders a bookmark block as a link with accessible text', () => {
    const blocks: NotionBlock[] = [
      { id: '9', type: 'bookmark', content: 'Read the article', href: 'https://example.com' },
    ]
    render(<NotionRenderer blocks={blocks} />)
    const link = screen.getByRole('link', { name: /read the article/i })
    expect(link).toHaveAttribute('href', 'https://example.com')
    expect(link).toHaveAttribute('target', '_blank')
    expect(link).toHaveAttribute('rel', 'noopener noreferrer')
  })

  it('renders a bookmark link with "(opens in new tab)" for screen readers', () => {
    const blocks: NotionBlock[] = [
      { id: '10', type: 'bookmark', content: 'Read more', href: 'https://example.com' },
    ]
    render(<NotionRenderer blocks={blocks} />)
    expect(screen.getByText('(opens in new tab)').className).toContain('sr-only')
  })

  it('renders a divider as hr', () => {
    const blocks: NotionBlock[] = [
      { id: '11', type: 'divider', content: '' },
    ]
    const { container } = render(<NotionRenderer blocks={blocks} />)
    expect(container.querySelector('hr')).toBeInTheDocument()
  })

  it('skips empty paragraph blocks', () => {
    const blocks: NotionBlock[] = [
      { id: '12', type: 'paragraph', content: '' },
    ]
    const { container } = render(<NotionRenderer blocks={blocks} />)
    expect(container.querySelectorAll('p')).toHaveLength(0)
  })
})
```

- [ ] **Step 2: Run tests — expect failures**

```bash
npm test
```

Expected: FAIL — `NotionRenderer` is not defined.

- [ ] **Step 3: Implement the block renderer**

Create `lib/notion-renderer.tsx`:

```typescript
import React from 'react'
import type { NotionBlock } from './types'

interface Props {
  blocks: NotionBlock[]
}

export function NotionRenderer({ blocks }: Props) {
  const grouped = groupBulletedLists(blocks)

  return (
    <div className="notion-body">
      {grouped.map((item, i) => {
        if (Array.isArray(item)) {
          return (
            <ul key={i} className="list-disc pl-6 mb-4 space-y-2">
              {item.map(block => (
                <li key={block.id} className="text-[19px] text-govuk-black leading-[1.5]">
                  {block.content}
                </li>
              ))}
            </ul>
          )
        }
        return <Block key={item.id} block={item} />
      })}
    </div>
  )
}

function Block({ block }: { block: NotionBlock }) {
  switch (block.type) {
    case 'heading_2':
      return (
        <h2 className="text-[27px] font-bold text-govuk-black mt-8 mb-4 leading-tight">
          {block.content}
        </h2>
      )
    case 'heading_3':
      return (
        <h3 className="text-[24px] font-bold text-govuk-black mt-6 mb-3 leading-tight">
          {block.content}
        </h3>
      )
    case 'paragraph':
      return block.content ? (
        <p className="text-[19px] text-govuk-black leading-[1.5] mb-4">
          {block.content}
        </p>
      ) : null
    case 'bookmark':
      return (
        <p className="mb-4">
          <a
            href={block.href}
            className="text-govuk-blue text-[19px] underline hover:text-govuk-black focus:outline-none focus:bg-govuk-yellow focus:text-govuk-black focus:shadow-[0_-2px_#ffdd00,0_4px_#0b0c0c]"
            target="_blank"
            rel="noopener noreferrer"
          >
            {block.content}
            <span className="sr-only"> (opens in new tab)</span>
          </a>
        </p>
      )
    case 'divider':
      return <hr className="border-govuk-mid-grey my-8" aria-hidden="true" />
    default:
      return null
  }
}

// Groups consecutive bulleted_list_items into arrays for rendering as <ul>
function groupBulletedLists(blocks: NotionBlock[]): (NotionBlock | NotionBlock[])[] {
  const result: (NotionBlock | NotionBlock[])[] = []
  let currentList: NotionBlock[] = []

  for (const block of blocks) {
    if (block.type === 'bulleted_list_item' || block.type === 'numbered_list_item') {
      currentList.push(block)
    } else {
      if (currentList.length > 0) {
        result.push([...currentList])
        currentList = []
      }
      result.push(block)
    }
  }

  if (currentList.length > 0) result.push([...currentList])
  return result
}
```

- [ ] **Step 4: Run tests — expect all pass**

```bash
npm test
```

Expected: All tests PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/notion-renderer.tsx tests/lib/notion-renderer.test.tsx
git commit -m "feat: add custom accessible Notion block renderer with tests"
```

---

## Task 5: Global Styles, Layout, Header & Footer

**Files:**
- Modify: `app/globals.css`
- Create: `app/layout.tsx`
- Create: `components/Header.tsx`
- Create: `components/Footer.tsx`

- [ ] **Step 1: Replace globals.css**

Replace the contents of `app/globals.css`:

```css
@import "tailwindcss";

/* ── Skip link ───────────────────────────────────────────────── */
.skip-link {
  position: absolute;
  top: -100%;
  left: 0;
  background: #ffdd00;
  color: #0b0c0c;
  font-size: 19px;
  font-weight: 700;
  padding: 8px 16px;
  z-index: 100;
  text-decoration: none;
}

.skip-link:focus {
  top: 0;
}

/* ── GOV.UK focus style (applies to all interactive elements) ── */
*:focus-visible {
  outline: 3px solid #ffdd00;
  outline-offset: 0;
  box-shadow: 0 -2px #ffdd00, 0 4px #0b0c0c;
}

/* ── Base ────────────────────────────────────────────────────── */
body {
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen, sans-serif;
  font-size: 19px;
  line-height: 1.5;
  color: #0b0c0c;
  background: #ffffff;
}
```

- [ ] **Step 2: Create the Header component**

Create `components/Header.tsx`:

```typescript
import Link from 'next/link'

export function Header() {
  return (
    <header className="bg-govuk-black" role="banner">
      <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
        <Link
          href="/"
          className="text-white font-bold text-[19px] no-underline hover:underline focus-visible:outline-none focus-visible:bg-govuk-yellow focus-visible:text-govuk-black focus-visible:px-1"
        >
          AI This Week
        </Link>
        <nav aria-label="Main navigation">
          <ul className="flex gap-6 list-none m-0 p-0">
            <li>
              <Link
                href="/issues"
                className="text-white text-[16px] underline hover:no-underline focus-visible:outline-none focus-visible:bg-govuk-yellow focus-visible:text-govuk-black focus-visible:px-1"
              >
                Issues
              </Link>
            </li>
            <li>
              <Link
                href="/about"
                className="text-white text-[16px] underline hover:no-underline focus-visible:outline-none focus-visible:bg-govuk-yellow focus-visible:text-govuk-black focus-visible:px-1"
              >
                About
              </Link>
            </li>
          </ul>
        </nav>
      </div>
    </header>
  )
}
```

- [ ] **Step 3: Create the Footer component**

Create `components/Footer.tsx`:

```typescript
import Link from 'next/link'

export function Footer() {
  return (
    <footer
      className="border-t-4 border-govuk-blue mt-16 py-8 bg-govuk-light-grey"
      role="contentinfo"
    >
      <div className="max-w-4xl mx-auto px-4">
        <p className="text-[16px] text-govuk-dark-grey">
          Summaries on this site are drafted with AI assistance and reviewed before
          publication.{' '}
          <Link href="/about" className="text-govuk-blue underline">
            Learn more
          </Link>
        </p>
      </div>
    </footer>
  )
}
```

- [ ] **Step 4: Create the root layout**

Replace the contents of `app/layout.tsx`:

```typescript
import type { Metadata } from 'next'
import './globals.css'
import { Header } from '@/components/Header'
import { Footer } from '@/components/Footer'

export const metadata: Metadata = {
  title: 'AI This Week',
  description: 'A weekly update on the latest in artificial intelligence.',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>
        <a href="#main-content" className="skip-link">
          Skip to main content
        </a>
        <Header />
        <main id="main-content" className="max-w-4xl mx-auto px-4 py-10" tabIndex={-1}>
          {children}
        </main>
        <Footer />
      </body>
    </html>
  )
}
```

- [ ] **Step 5: Run dev server and check visually**

```bash
npm run dev
```

Open http://localhost:3000. Verify:
- Black header bar with "AI This Week" and nav links
- Footer with disclosure text
- Tab to the page — skip link appears as first focusable element with yellow background
- Tab again — header links receive yellow focus ring

- [ ] **Step 6: Commit**

```bash
git add app/globals.css app/layout.tsx components/Header.tsx components/Footer.tsx
git commit -m "feat: add accessible layout shell with GOV.UK header and footer"
```

---

## Task 6: Home Redirect

**Files:**
- Modify: `app/page.tsx`

- [ ] **Step 1: Replace app/page.tsx**

Replace the entire contents of `app/page.tsx`:

```typescript
import { redirect } from 'next/navigation'
import { getLatestIssue } from '@/lib/notion'

export const revalidate = 300

export default async function Home() {
  const latest = await getLatestIssue()
  if (latest) {
    redirect(`/issues/${latest.slug}`)
  }
  redirect('/issues')
}
```

- [ ] **Step 2: Verify redirect works (requires real Notion credentials)**

If you have real credentials in `.env.local`:

```bash
npm run dev
```

Open http://localhost:3000. Should redirect to `/issues/YYYY-MM-DD` if an issue exists, or `/issues` if not.

If credentials are not set up yet, confirm the file is saved and move on — this is testable end-to-end in Task 11.

- [ ] **Step 3: Commit**

```bash
git add app/page.tsx
git commit -m "feat: add home route that redirects to latest published issue"
```

---

## Task 7: MetadataStrip & AIDisclosureBadge Components

**Files:**
- Create: `components/MetadataStrip.tsx`
- Create: `components/AIDisclosureBadge.tsx`

- [ ] **Step 1: Create MetadataStrip**

Create `components/MetadataStrip.tsx`:

```typescript
interface Props {
  issueNumber: number
  issueDate: string  // YYYY-MM-DD
}

function formatDate(isoDate: string): string {
  const date = new Date(isoDate + 'T12:00:00Z') // noon UTC avoids timezone shift
  return date.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

export function MetadataStrip({ issueNumber, issueDate }: Props) {
  return (
    <div className="flex gap-4 text-[16px] text-govuk-dark-grey mb-2" aria-label="Issue details">
      <span>Issue {issueNumber}</span>
      <span aria-hidden="true">·</span>
      <time dateTime={issueDate}>{formatDate(issueDate)}</time>
    </div>
  )
}
```

- [ ] **Step 2: Create AIDisclosureBadge**

Create `components/AIDisclosureBadge.tsx`:

```typescript
export function AIDisclosureBadge() {
  return (
    <div
      className="flex items-start gap-3 bg-govuk-light-grey border-l-4 border-govuk-mid-grey px-4 py-3 mb-6"
      role="note"
      aria-label="AI content disclosure"
    >
      <span className="font-bold text-[19px] text-govuk-black" aria-hidden="true">!</span>
      <p className="text-[16px] text-govuk-black m-0">
        Summaries in this issue are AI-assisted.
      </p>
    </div>
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add components/MetadataStrip.tsx components/AIDisclosureBadge.tsx
git commit -m "feat: add MetadataStrip and AIDisclosureBadge components"
```

---

## Task 8: Individual Issue Page

**Files:**
- Create: `app/issues/[date]/page.tsx`

- [ ] **Step 1: Create the issue page**

```bash
mkdir -p "app/issues/[date]"
```

Create `app/issues/[date]/page.tsx`:

```typescript
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { getIssueByDate, getIssueBlocks, getPublishedIssues } from '@/lib/notion'
import { NotionRenderer } from '@/lib/notion-renderer'
import { MetadataStrip } from '@/components/MetadataStrip'
import { AIDisclosureBadge } from '@/components/AIDisclosureBadge'

export const revalidate = 300

interface Props {
  params: Promise<{ date: string }>
}

export async function generateStaticParams() {
  const issues = await getPublishedIssues()
  return issues.map(issue => ({ date: issue.slug }))
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { date } = await params
  const issue = await getIssueByDate(date)
  if (!issue) return {}
  return {
    title: `${issue.title} | AI This Week`,
    description: issue.summary,
  }
}

export default async function IssuePage({ params }: Props) {
  const { date } = await params
  const issue = await getIssueByDate(date)
  if (!issue) notFound()

  const blocks = await getIssueBlocks(issue.id)

  return (
    <article aria-label={issue.title}>
      <MetadataStrip issueNumber={issue.issueNumber} issueDate={issue.issueDate} />
      {issue.aiAssisted && <AIDisclosureBadge />}
      <h1 className="text-[48px] font-bold text-govuk-black leading-tight mb-8 mt-2">
        {issue.title}
      </h1>
      <NotionRenderer blocks={blocks} />
    </article>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add "app/issues/[date]/page.tsx"
git commit -m "feat: add individual issue page with ISR"
```

---

## Task 9: IssueCard & Archive Index

**Files:**
- Create: `components/IssueCard.tsx`
- Create: `app/issues/page.tsx`

- [ ] **Step 1: Create IssueCard component**

Create `components/IssueCard.tsx`:

```typescript
import Link from 'next/link'
import type { Issue } from '@/lib/types'

interface Props {
  issue: Issue
}

function formatDate(isoDate: string): string {
  const date = new Date(isoDate + 'T12:00:00Z')
  return date.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

export function IssueCard({ issue }: Props) {
  return (
    <div className="border-b border-govuk-mid-grey pb-6">
      <div className="flex gap-3 text-[16px] text-govuk-dark-grey mb-1">
        <span>Issue {issue.issueNumber}</span>
        <span aria-hidden="true">·</span>
        <time dateTime={issue.issueDate}>{formatDate(issue.issueDate)}</time>
      </div>
      <h2 className="text-[24px] font-bold text-govuk-black mb-2 leading-tight">
        <Link
          href={`/issues/${issue.slug}`}
          className="text-govuk-blue underline hover:text-govuk-black"
        >
          {issue.title}
        </Link>
      </h2>
      {issue.summary && (
        <p className="text-[19px] text-govuk-black leading-[1.5] m-0">{issue.summary}</p>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Create the archive index page**

```bash
mkdir -p app/issues
```

Create `app/issues/page.tsx`:

```typescript
import type { Metadata } from 'next'
import { getPublishedIssues } from '@/lib/notion'
import { IssueCard } from '@/components/IssueCard'

export const revalidate = 300

export const metadata: Metadata = {
  title: 'All Issues | AI This Week',
  description: 'Browse every edition of AI This Week.',
}

export default async function IssuesPage() {
  const issues = await getPublishedIssues()

  return (
    <>
      <h1 className="text-[48px] font-bold text-govuk-black leading-tight mb-10">
        All Issues
      </h1>
      {issues.length === 0 ? (
        <p className="text-[19px] text-govuk-black">No issues published yet.</p>
      ) : (
        <ul className="space-y-8 list-none p-0" aria-label="All newsletter issues">
          {issues.map(issue => (
            <li key={issue.id}>
              <IssueCard issue={issue} />
            </li>
          ))}
        </ul>
      )}
    </>
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add components/IssueCard.tsx app/issues/page.tsx
git commit -m "feat: add archive index page and IssueCard component"
```

---

## Task 10: About Page

**Files:**
- Create: `app/about/page.tsx`

- [ ] **Step 1: Create the about page**

```bash
mkdir -p app/about
```

Create `app/about/page.tsx`:

```typescript
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'About | AI This Week',
  description: 'About AI This Week and our AI content disclosure.',
}

export default function AboutPage() {
  return (
    <>
      <h1 className="text-[48px] font-bold text-govuk-black leading-tight mb-8">
        About AI This Week
      </h1>

      <section aria-label="About the newsletter" className="mb-10">
        <h2 className="text-[27px] font-bold text-govuk-black mb-4">What is this?</h2>
        <p className="text-[19px] text-govuk-black leading-[1.5] mb-4">
          AI This Week is a weekly newsletter covering the latest developments in
          artificial intelligence — from policy and workforce impact to technical
          research and new tools. It is written for professionals working in or
          alongside AI.
        </p>
      </section>

      <section aria-label="AI content disclosure" className="mb-10">
        <h2 className="text-[27px] font-bold text-govuk-black mb-4">AI content disclosure</h2>
        <p className="text-[19px] text-govuk-black leading-[1.5] mb-4">
          Some article summaries on this site are drafted with AI assistance.
          All AI-assisted content is reviewed and edited by a human editor before
          publication. Issues that contain AI-assisted summaries are marked with
          a disclosure notice at the top of the page.
        </p>
        <p className="text-[19px] text-govuk-black leading-[1.5]">
          This disclosure is provided in the interest of transparency. If you
          have questions about our editorial process, contact us directly.
        </p>
      </section>
    </>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add app/about/page.tsx
git commit -m "feat: add about page with AI disclosure statement"
```

---

## Task 11: Sitemap

**Files:**
- Create: `app/sitemap.ts`

- [ ] **Step 1: Create sitemap.ts**

Create `app/sitemap.ts`:

```typescript
import type { MetadataRoute } from 'next'
import { getPublishedIssues } from '@/lib/notion'

export const revalidate = 300

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const BASE_URL =
    process.env.NEXT_PUBLIC_BASE_URL ?? 'https://ai-this-week.vercel.app'

  const issues = await getPublishedIssues()

  return [
    { url: `${BASE_URL}/`, lastModified: new Date() },
    { url: `${BASE_URL}/issues`, lastModified: new Date() },
    { url: `${BASE_URL}/about`, lastModified: new Date() },
    ...issues.map(issue => ({
      url: `${BASE_URL}/issues/${issue.slug}`,
      lastModified: new Date(issue.issueDate + 'T12:00:00Z'),
    })),
  ]
}
```

- [ ] **Step 2: Commit**

```bash
git add app/sitemap.ts
git commit -m "feat: add auto-generated sitemap"
```

---

## Task 12: Notion Database Setup & End-to-End Verification

**Files:**
- None (Notion + Vercel config, then smoke test)

- [ ] **Step 1: Create the Notion integration**

1. Go to https://www.notion.so/my-integrations
2. Click "New integration"
3. Name it "AI This Week Site"
4. Select your workspace
5. Under Capabilities, enable: Read content
6. Click Save → copy the **Internal Integration Token**
7. Paste it into `.env.local` as `NOTION_TOKEN=<token>`

- [ ] **Step 2: Create the Notion database**

In Notion, create a new **full-page database** (not inline) named "AI This Week".

Add these properties (Notion creates a "Name" title field by default — rename it to "Title"):

| Property name | Type |
|---|---|
| Title | Title (default) |
| Issue Date | Date |
| Issue Number | Number |
| Published | Checkbox |
| Summary | Text |
| AI Assisted | Checkbox |

- [ ] **Step 3: Share the database with your integration**

1. Open the database in Notion
2. Click "..." menu → "Add connections"
3. Search for "AI This Week Site" and connect it
4. Copy the database ID from the URL: `notion.so/<workspace>/<DATABASE_ID>?v=...`
   - The database ID is the 32-character string before the `?`
5. Paste it into `.env.local` as `NOTION_DATABASE_ID=<id>`

- [ ] **Step 4: Add a test issue to Notion**

Create one row in the database:
- **Title**: "AI This Week — Test Issue"
- **Issue Date**: today's date
- **Issue Number**: 1
- **Published**: ✓ checked
- **Summary**: "This is a test issue."
- **AI Assisted**: ✓ checked
- Open the page and add a few blocks: a `Heading 2`, a paragraph, and a bulleted list item

- [ ] **Step 5: Run the dev server and smoke test all routes**

```bash
npm run dev
```

Check each route:

| URL | Expected |
|---|---|
| http://localhost:3000/ | Redirects to `/issues/YYYY-MM-DD` |
| http://localhost:3000/issues | Shows "All Issues" list with your test issue |
| http://localhost:3000/issues/YYYY-MM-DD | Shows issue with metadata strip, AI badge, and rendered blocks |
| http://localhost:3000/about | Shows About page with disclosure |
| http://localhost:3000/sitemap.xml | Shows XML with all issue URLs |

- [ ] **Step 6: Keyboard accessibility check**

On the issue page:
1. Tab through the page — every interactive element should receive a yellow focus ring
2. Confirm skip link appears as first tab stop with yellow background
3. Confirm "Read more" links announce "(opens in new tab)" to screen reader
4. Confirm AI disclosure badge is present and has `role="note"`

- [ ] **Step 7: Run all tests one final time**

```bash
npm test
```

Expected: All tests PASS.

- [ ] **Step 8: Set environment variables in Vercel**

In your Vercel project dashboard:
1. Settings → Environment Variables
2. Add `NOTION_TOKEN` (Production + Preview + Development)
3. Add `NOTION_DATABASE_ID` (Production + Preview + Development)
4. Add `NEXT_PUBLIC_BASE_URL` = `https://your-actual-domain.vercel.app` (Production only)

- [ ] **Step 9: Final commit**

```bash
git add -A
git commit -m "chore: final cleanup and Notion setup documentation"
```

---

## Spec Coverage Check

| Spec requirement | Task |
|---|---|
| Notion as CMS | Tasks 3, 12 |
| ISR revalidate=300 | Tasks 6, 8, 9, 11 |
| All Notion access isolated in lib/notion.ts | Task 3 |
| Custom block renderer | Task 4 |
| / redirects to latest issue | Task 6 |
| /issues archive index | Task 9 |
| /issues/[date] individual issue | Task 8 |
| /about static page | Task 10 |
| /sitemap.xml | Task 11 |
| Skip-to-content link | Task 5 |
| GOV.UK colour tokens in Tailwind | Task 1 |
| GOV.UK focus ring | Task 5 |
| System font stack (not GDS Transport) | Task 5 |
| H1/H2/body type scale (3 styles max) | Tasks 4, 5 |
| MetadataStrip (issue number + date) | Task 7 |
| AI disclosure badge (conditional) | Task 7 |
| Footer disclosure on every page | Task 5 |
| AI Assisted Notion property | Task 12 |
| Semantic landmarks (header/nav/main/footer/article) | Tasks 5, 8 |
| Descriptive link text with sr-only suffix | Task 4 |
| Published checkbox safety gate | Task 3 |
| NOTION_TOKEN + NOTION_DATABASE_ID env vars | Tasks 1, 12 |
