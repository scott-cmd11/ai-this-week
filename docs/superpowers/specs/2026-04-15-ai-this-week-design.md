# AI This Week — Website Design Spec

**Date:** 2026-04-15
**Status:** Approved

---

## Overview

A weekly AI newsletter website that the author updates each Monday by publishing a new issue to a Notion database. The site fetches content from Notion at build time and serves static HTML via Vercel. No email subscription — purely a web destination.

---

## Architecture

```
Notion database (one page per issue)
      ↓  Notion API — @notionhq/client
Next.js 15 App Router (TypeScript, Tailwind CSS)
      ↓  ISR — export const revalidate = 300 (5 min)
Vercel CDN — static HTML served to readers
```

- **Framework:** Next.js 15, App Router, TypeScript, Tailwind CSS
- **Content source:** Notion API — one database, one page per issue
- **Rendering strategy:** ISR with `revalidate = 300`. Pages are static by default; Notion is re-polled every 5 minutes. No webhooks or deploy triggers required.
- **Deployment:** Vercel
- **Notion auth:** Integration token stored as `NOTION_TOKEN` environment variable in Vercel. Database ID stored as `NOTION_DATABASE_ID`.

### Data layer isolation

All Notion access is confined to `lib/notion.ts`. This file exports typed functions:
- `getPublishedIssues()` — returns all issues where `Published = true`, sorted by `Issue Date` descending
- `getIssueByDate(date: string)` — returns a single issue by its date slug
- `getLatestIssue()` — returns the most recent published issue

No other file imports from `@notionhq/client` directly. Schema changes require updating only `lib/notion.ts`.

---

## Notion Database Schema

One database named **"AI This Week"**. Each row is one issue.

| Property | Type | Purpose |
|---|---|---|
| `Title` | Title | Issue headline (e.g. "AI This Week — Apr 14, 2026") |
| `Issue Date` | Date | Drives URL slug `/issues/YYYY-MM-DD` and sort order. **Do not rename** — slug generation depends on this property name. |
| `Issue Number` | Number | Displayed as "Issue 42" in the header strip |
| `Published` | Checkbox | Safety gate — only checked issues appear on the site |
| `Summary` | Rich Text | One-sentence teaser shown on the archive index |
| `AI Assisted` | Checkbox | When checked, displays an inline AI-disclosure notice on the issue page |

### Page body structure

The full newsletter body lives as Notion blocks inside each database page. No special formatting required — write naturally using Notion's built-in block types:

- `Heading 2` → section label (e.g. "Bright Spot of the Week", "Tool of the Week", "Deep Dive")
- `Bulleted list item` → individual story items (emoji prefix is fine)
- `Paragraph` → body text / summaries
- `Bookmark` or `Link` → "Read more" links

The block renderer is a **custom renderer** (`lib/notion-renderer.tsx`) — not a third-party library. This gives full control over the HTML output and ARIA attributes, which is required to meet the accessibility spec. Each Notion block type maps to a specific React component. New block types (callouts, tables, etc.) can be added by extending the renderer without touching other code.

---

## Routing

| Route | Description |
|---|---|
| `/` | Server redirect to the latest published issue (`/issues/YYYY-MM-DD`) |
| `/issues` | Archive index — all published issues, newest first. Shows: title, issue number, date, summary. |
| `/issues/[date]` | Individual issue page. `date` param = `YYYY-MM-DD` format derived from `Issue Date` property. |
| `/about` | Static page — what the newsletter is, who writes it, full AI disclosure statement. |
| `/sitemap.xml` | Auto-generated. One URL per published issue. |

URL slugs are derived from the `Issue Date` Notion property. Example: an issue dated `2026-04-14` resolves to `/issues/2026-04-14`.

---

## Page Layout

### Every page
- **Skip-to-content link** — visually hidden, first focusable element on the page
- **GOV.UK-style header** — black bar, "AI This Week" left-aligned, nav links ("Issues", "About") right-aligned
- **`<main>` landmark** with `id="main-content"` (skip link target)
- **Footer** — persistent AI disclosure: *"Summaries on this site are drafted with AI assistance and reviewed before publication."* + link to `/about`

### Issue page (`/issues/[date]`)
1. Metadata strip: issue number, date (formatted as "14 April 2026"), AI-assisted badge (if `AI Assisted = true`)
2. Issue title (`<h1>`)
3. Newsletter body — Notion blocks rendered section by section
4. Footer

### Archive index (`/issues`)
- `<h1>` "All Issues"
- List of issue cards, newest first
- Each card: issue number, date, title (linked to issue), summary

---

## Design System & Accessibility

### Colour tokens (GOV.UK)

| Token | Hex | Usage |
|---|---|---|
| `govuk-black` | `#0b0c0c` | Primary text — 21:1 contrast on white (AAA) |
| `govuk-blue` | `#1d70b8` | Links — 5.9:1 contrast on white (AA) |
| `govuk-yellow` | `#ffdd00` | Focus ring fill |
| `govuk-black` | `#0b0c0c` | Focus ring outline (3px solid) |
| `govuk-light-grey` | `#f3f2f1` | AI-assisted badge background |
| `govuk-mid-grey` | `#b1b4b6` | Metadata / secondary text |

Tailwind's theme is extended with these values so utility classes map directly to GOV.UK tokens.

### Typography

- **Font:** System-sans stack — `-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen, sans-serif`. GDS Transport is licensed for GOV.UK domains only and cannot be used on third-party sites; GOV.UK Frontend falls back to this same stack automatically. No visual compromise.
- **Base size:** 19px, line-height 1.5
- **Scale (3 styles max per page):**
  - H1: 48px / 700 weight (issue title)
  - H2: 27px / 700 weight (section headings within issue)
  - Body: 19px / 400 weight

### Accessibility checklist (enforced at build)

- Skip-to-content link on every page
- All `<a>` elements have descriptive accessible text — "Read more" links include a visually-hidden issue title suffix
- Semantic landmarks on every page: `<header>`, `<nav>`, `<main>`, `<footer>`, `<article>`
- Sections within an issue page use `<section aria-label="[section name]">`
- Colour is never the sole means of conveying information
- All interactive elements meet 44×44px touch target minimum
- No hover-only functionality
- Tested against: VoiceOver (macOS), keyboard-only navigation

### AI disclosure (two-level)

1. **Inline badge** (per-issue, conditional on `AI Assisted` checkbox): GOV.UK warning-text style (`!` icon + "Summaries in this issue are AI-assisted") displayed directly below the metadata strip.
2. **Footer disclosure** (all pages): Plain-language statement linking to `/about` for full detail.

---

## What is explicitly out of scope

- Email subscription / mailing list
- Search within issues
- Comments or reader interaction
- Admin UI / web-based publish button
- Authentication / login

---

## Open questions

None — all decisions confirmed during design session.
