# Website Redesign — Warm Newsletter Aesthetic

**Date:** 2026-05-02
**Scope:** Full site + admin (Option B: new design system + selective rebuilds)
**Direction:** Modern newsletter app — warm, approachable, Morning Brew / Substack energy

---

## 1. Design System

### Color Palette

All `ws-*` CSS variables replaced in `app/globals.css`:

| Token | New Value | Role |
|-------|-----------|------|
| `--color-ws-page` | `#FAF8F4` | Page background (warm cream) |
| `--color-ws-black` | `#1C1917` | Headings, borders (warm charcoal, not pure black) |
| `--color-ws-accent` | `#D97706` | Links, CTAs, highlights (amber-600) |
| `--color-ws-accent-hover` | `#B45309` | Hover state (amber-700) |
| `--color-ws-accent-light` | `#FEF3C7` | Tinted fill backgrounds (amber-100) |
| `--color-ws-muted` | `#78716C` | Secondary text (stone-500) |
| `--color-ws-border` | `#E7E0D8` | Dividers (warm sand) |
| `--color-ws-white` | `#FFFFFF` | Cards, panels |

### Typography

Two fonts via Google Fonts (`next/font/google`):

- **DM Serif Display** — display headings: homepage H1, issue page H1 and H2 section headers, sign-in title
- **DM Sans** — everything else: nav, body copy, labels, buttons, admin UI, footer

Implementation: add both to `app/layout.tsx` via `next/font/google`, expose as CSS variables (`--font-display`, `--font-sans`), apply via Tailwind config.

### What changes everywhere automatically
Swapping CSS variables cascades through all `ws-*` Tailwind classes site-wide. Font variables flow through `font-display` and `font-sans` utility classes.

---

## 2. Shared Components

### NeoPopCard (`components/NeoPop/NeoPopCard.tsx`)

Remove the brutalist border + offset shadow treatment. Replace with natural elevation:

- Shell: `bg-white border border-ws-border shadow-[0_2px_8px_rgba(28,25,23,0.07)] rounded-sm`
- Remove: `border-[3px] border-ws-black shadow-[8px_8px_0_0_var(--color-ws-black)]`
- `bg="yellow"` hero variant: `bg-amber-50` with a `border-l-4 border-ws-accent` left stripe instead of yellow fill
- Interactive hover: `hover:shadow-[0_4px_16px_rgba(28,25,23,0.10)] transition-shadow duration-150`

### NeoPopButton (`components/NeoPop/NeoPopButton.tsx`)

Replace harsh black + offset shadow with warm rounded button:

- Primary: `bg-ws-accent text-white rounded-sm px-5 py-2.5 font-semibold hover:bg-ws-accent-hover hover:-translate-y-px transition-all duration-150`
- Secondary/outline: `border border-ws-accent text-ws-accent rounded-sm px-5 py-2.5 hover:bg-amber-50`
- Remove: `border-[3px] border-ws-black shadow-[4px_4px_0_0_var(--color-ws-black)]` offset shadow

### Header (`components/Header.tsx`)

- Background: `bg-ws-page border-b border-ws-border`
- On scroll: add `shadow-[0_1px_8px_rgba(28,25,23,0.06)]` via scroll listener or CSS
- Site name: DM Serif Display, warm charcoal
- Nav links: DM Sans, `text-ws-muted hover:text-ws-black`
- Remove: uppercase tracking on nav items — use sentence case

### Footer (`components/Footer.tsx`)

- Background: `bg-ws-page border-t border-ws-border` (cream, not white)
- Typography rethemed to DM Sans, warm stone palette
- Social icons: `text-ws-muted hover:text-ws-black`
- Structure unchanged (social links + byline rows)

---

## 3. Homepage (`app/page.tsx`)

### Hero section
- `NeoPopCard bg="yellow"` becomes warm cream card with amber left border stripe
- H1: DM Serif Display, still large and bold
- Accent bar: amber instead of teal
- Summary paragraph: DM Sans, `text-ws-black/80`

### Latest issue card
- Standard warm card treatment via updated NeoPopCard
- "Latest issue" label: amber background `bg-ws-accent text-white`

### Past issues list
- Already compact divider rows — retheme only:
  - Title hover: `group-hover:text-ws-accent`
  - Issue number badge: `text-ws-muted`
  - Date: `text-ws-muted`
  - Dividers: `divide-ws-border`

### AI Canada Pulse crosslink
- Left border stripe: `border-l-4 border-ws-accent`
- Text rethemed to warm palette

---

## 4. Issue Pages (`lib/notion-renderer.tsx`, `app/issues/[date]/page.tsx`)

Layout structure unchanged. Visual retheme only.

### Section headers (SectionHeader)
- Shell: `bg-ws-black` → `bg-[#1C1917]` (warm charcoal, same token)
- Overline: `text-ws-accent` (amber, same token — just changes with CSS var swap)
- Title: DM Serif Display via `font-display` class
- Tagline + count: warm stone

### Article cards (ArticleCard)
- Remove: `border-[2px] border-ws-black`
- Replace: `border border-ws-border shadow-[0_2px_8px_rgba(28,25,23,0.07)] rounded-sm`
- Hover: `hover:shadow-[0_4px_16px_rgba(28,25,23,0.10)] hover:border-ws-accent/30`

### No-image fill
- Remove: `bg-ws-accent-light` (teal-light)
- Replace: `bg-amber-50` with `text-ws-black/10` large number

### Attribution footer in cards
- Hostname link: `text-ws-accent hover:text-ws-accent-hover`

---

## 5. Admin (`app/admin/`)

### WizardStepBar (`_wizard-step-bar.tsx`)

Replace row of bordered rectangular chips with a proper stepper:

```
[1] ——— [2] ——— [3] ——— [4] ——— [5]
Briefings  Research  Events  Draft  Publish
```

- Container: `bg-[#1C1917] px-6 py-4 flex items-center justify-center gap-0`
- Each step: numbered circle + connecting line + label below
- Active: filled amber circle (`bg-ws-accent text-white w-8 h-8 rounded-full`)
- Done: charcoal checkmark circle (`bg-white/20 text-white`)
- Future: empty circle (`border-2 border-white/20 text-white/30`)
- Connecting line between steps: `h-px flex-1 bg-white/15` (done segments: `bg-ws-accent/40`)
- Labels: `text-[11px] font-medium mt-1` below each circle, shown on sm+ only

### Wizard navigation footer (in `page.tsx`)

Replace small bordered arrows with clear, prominent buttons:

- **Back**: text-only link `← Back` in `text-ws-muted hover:text-ws-black text-[14px] font-medium`
- **Continue**: large amber button `bg-ws-accent text-white px-8 py-3 rounded-sm text-[15px] font-semibold hover:bg-ws-accent-hover hover:-translate-y-px transition-all`
  - Label: `Continue to {STEP_LABELS[wizNextStep]} →` (spells out next step name)
  - Last step: `Complete workflow ✓` in same style
- Layout: `flex items-center justify-between mt-10 pt-6 border-t border-ws-border`

### Wizard body

- Page background: `bg-ws-page` (cream)
- Step title H2: DM Serif Display
- Date header: DM Sans, lighter weight, drop uppercase tracking

### WorkflowSidebar (`_workflow-sidebar.tsx`)

- Background: `bg-[#1C1917]` (warm charcoal, same as step bar)
- Active step: amber left border + amber number badge (same as now, just amber instead of teal)
- Hover states: `hover:bg-white/8`

### Sign-in page

- Container: warm cream background
- Card: `border border-ws-border shadow-[0_2px_16px_rgba(28,25,23,0.08)] rounded-sm`
- Input: `border border-ws-border focus:border-ws-accent rounded-sm`
- Button: warm amber primary button (matches new NeoPopButton)
- H1: DM Serif Display

---

## Files to Modify

| File | Change |
|------|--------|
| `app/globals.css` | Swap all `ws-*` CSS variable values |
| `app/layout.tsx` | Add DM Serif Display + DM Sans via `next/font/google`, expose as CSS vars, wire to Tailwind |
| `tailwind.config.ts` | Add `fontFamily: { display: ['var(--font-display)'], sans: ['var(--font-sans)'] }` |
| `components/NeoPop/NeoPopCard.tsx` | Remove brutal border/shadow, add natural elevation |
| `components/NeoPop/NeoPopButton.tsx` | Warm rounded button, remove offset shadow |
| `components/Header.tsx` | Cream bg, warm nav, DM Serif Display site name |
| `components/Footer.tsx` | Cream bg, warm palette |
| `app/page.tsx` | Retheme hero, latest issue label, crosslink |
| `lib/notion-renderer.tsx` | Article card borders/shadows, no-image fill color, display font on section headers |
| `app/admin/_wizard-step-bar.tsx` | Replace chip row with proper stepper component |
| `app/admin/page.tsx` | Larger nav buttons in wizard footer, display font on step title, cream bg |
| `app/admin/_workflow-sidebar.tsx` | Warm charcoal (token swap covers most of it) |

---

## Preserved Invariants

- All layout structures unchanged
- Issue page card grid layout (3-col, hero span) — retheme only
- Admin wizard 5-step flow — UX unchanged, just bigger nav buttons
- All `ws-*` class names retained — only the CSS variable values change
- TOC anchor IDs and scroll offsets on section headers — unchanged
- Mobile responsiveness — all existing breakpoints preserved

---

## Build Sequence

1. CSS variables + font setup (`globals.css`, `layout.tsx`, `tailwind.config.ts`)
2. NeoPopCard + NeoPopButton (cascades across whole site)
3. Header + Footer
4. Homepage (`app/page.tsx`)
5. Issue page cards (`lib/notion-renderer.tsx`)
6. Admin step bar (`_wizard-step-bar.tsx`)
7. Admin wizard nav + body (`page.tsx`)
8. TypeScript check + visual QA
