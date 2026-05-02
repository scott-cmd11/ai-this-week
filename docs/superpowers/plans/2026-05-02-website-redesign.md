# Website Redesign — Warm Newsletter Aesthetic Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Retheme the full site and admin from a cool institutional palette (teal/charcoal) to a warm newsletter aesthetic (amber/cream/charcoal) with DM Serif Display + DM Sans typography.

**Architecture:** CSS token swap in `globals.css` cascades ~80% of color changes site-wide. Explicit code edits handle font wiring, component structural tweaks, article card retheme, and the WizardStepBar stepper redesign. No layout structure changes — visual retheme only.

**Tech Stack:** Next.js 16 App Router, Tailwind CSS v4 (CSS-first, no `tailwind.config.ts`), `next/font/google`, TypeScript.

---

## File Map

| File | Change |
|------|--------|
| `app/globals.css` | Swap `ws-*` color tokens + add `--font-display`/`--font-sans` to `@theme`; update `body` font |
| `app/layout.tsx` | Import DM Serif Display + DM Sans via `next/font/google`; apply CSS vars to `<html>` |
| `components/NeoPop/NeoPopCard.tsx` | `bg="yellow"` hero variant → amber-50 + amber left stripe |
| `components/Header.tsx` | `bg-ws-white` → `bg-ws-page`; add `font-display` to site name |
| `components/Footer.tsx` | `bg-ws-white` → `bg-ws-page` |
| `app/page.tsx` | Add `font-display` to H1; minor retheme to latest-issue label and past issues |
| `app/issues/[date]/page.tsx` | Add `font-display` to issue page H1 |
| `lib/notion-renderer.tsx` | Article card: softer borders, warm shadows, amber hover; no-image fill to `bg-amber-50`; add `font-display` to section header title |
| `app/admin/_wizard-step-bar.tsx` | Redesign: proper numbered stepper with connecting lines |
| `app/admin/page.tsx` | Sign-in card: softer style; wizard nav footer: large amber buttons; step title: `font-display`; date header: lighter weight |

---

## Task 1: CSS Tokens + Font Variables

**Files:**
- Modify: `app/globals.css`

- [ ] **Step 1: Swap the color tokens and add font CSS variables in `@theme`**

Replace the entire `@theme` block in `app/globals.css`:

```css
@theme {
  --color-ws-black: #1C1917;
  --color-ws-text: #1C1917;
  --color-ws-muted: #78716C;
  --color-ws-border: #E7E0D8;
  --color-ws-surface: #FFFFFF;
  --color-ws-page: #FAF8F4;
  --color-ws-accent: #D97706;
  --color-ws-accent-hover: #B45309;
  --color-ws-accent-light: #FEF3C7;
  --color-ws-white: #FFFFFF;

  /* Legacy aliases */
  --color-neopop-black: #1C1917;
  --color-neopop-white: #FFFFFF;
  --color-neopop-red: #D97706;
  --color-neopop-red-dark: #B45309;
  --color-neopop-yellow: #FEF3C7;
  --color-neopop-cream: #FAF8F4;

  --color-focus: #D97706;
  --color-focus-text: #FFFFFF;

  --font-display: "DM Serif Display", Georgia, serif;
  --font-sans: "DM Sans", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
}
```

Also update the `body` rule in `app/globals.css` to use the new font variable:

```css
body {
  font-family: var(--font-sans);
  font-size: 19px;
  line-height: 1.5;
  color: var(--color-ws-text);
  background: var(--color-ws-page);
}
```

- [ ] **Step 2: Commit**

```bash
git add app/globals.css
git commit -m "feat(design): warm palette tokens + font CSS variables"
```

---

## Task 2: Google Fonts in layout.tsx

**Files:**
- Modify: `app/layout.tsx`

- [ ] **Step 1: Add DM Serif Display + DM Sans imports and wire CSS variables**

Replace `app/layout.tsx` with:

```tsx
import type { Metadata } from 'next'
import { DM_Serif_Display, DM_Sans } from 'next/font/google'
import './globals.css'
import { Header } from '@/components/Header'
import { Footer } from '@/components/Footer'
import { Analytics } from '@vercel/analytics/react'

const dmSerifDisplay = DM_Serif_Display({
  subsets: ['latin'],
  weight: '400',
  variable: '--font-display',
  display: 'swap',
})

const dmSans = DM_Sans({
  subsets: ['latin'],
  variable: '--font-sans',
  display: 'swap',
})

const SITE_URL = process.env.NEXT_PUBLIC_BASE_URL ?? 'https://ai-this-week.vercel.app'

export const metadata: Metadata = {
  title: 'AI Today',
  description: 'Daily AI news from Canada and around the world, plus trending stories and research — in plain English.',
  alternates: {
    types: {
      'application/rss+xml': `${SITE_URL}/feed.xml`,
    },
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className={`${dmSerifDisplay.variable} ${dmSans.variable}`}>
      <body>
        <a href="#main-content" className="skip-link">
          Skip to main content
        </a>
        <Header />
        <main id="main-content" className="max-w-4xl mx-auto px-4 py-10" tabIndex={-1}>
          {children}
        </main>
        <Footer />
        <Analytics />
      </body>
    </html>
  )
}
```

- [ ] **Step 2: Run TypeScript check to confirm no errors**

```bash
npx tsc --noEmit 2>&1 | head -30
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add app/layout.tsx
git commit -m "feat(design): add DM Serif Display + DM Sans via next/font/google"
```

---

## Task 3: NeoPopCard Hero Variant + Header + Footer

**Files:**
- Modify: `components/NeoPop/NeoPopCard.tsx`
- Modify: `components/Header.tsx`
- Modify: `components/Footer.tsx`

- [ ] **Step 1: Update NeoPopCard `bg="yellow"` hero variant**

The `yellow` bg currently maps to `bg-ws-accent-light` (flat fill). The spec replaces this with an amber-50 background and amber left border stripe.

In `components/NeoPop/NeoPopCard.tsx`, change the `bgClasses` map so `yellow` gets the left stripe treatment, and adjust the card shell to support it:

```tsx
import Link from 'next/link'
import type { ReactNode } from 'react'

interface Props {
  href?: string
  children: ReactNode
  bg?: 'white' | 'yellow' | 'red' | 'cream' | 'accent-light' | 'accent' | 'page'
  interactive?: boolean
}

const bgClasses: Record<string, string> = {
  white: 'bg-ws-white',
  'accent-light': 'bg-ws-accent-light',
  yellow: 'bg-amber-50 border-l-4 border-ws-accent',
  accent: 'bg-ws-accent text-ws-white',
  red: 'bg-ws-accent text-ws-white',
  page: 'bg-ws-page',
  cream: 'bg-ws-page',
}

export function NeoPopCard({ href, children, bg = 'white', interactive }: Props) {
  const isInteractive = interactive ?? Boolean(href)

  const className = [
    'block',
    bg === 'yellow' ? '' : 'border border-ws-border',
    'rounded-sm',
    bgClasses[bg] || bgClasses.white,
    'p-6',
    'no-underline',
    'shadow-[0_2px_8px_rgba(28,25,23,0.07)]',
    'transition-[border-color,box-shadow] duration-150 ease-out',
    isInteractive
      ? 'hover:shadow-[0_4px_16px_rgba(28,25,23,0.10)]'
      : '',
  ].join(' ')

  if (href) {
    return (
      <Link href={href} className={className}>
        {children}
      </Link>
    )
  }

  return <div className={className}>{children}</div>
}
```

- [ ] **Step 2: Update Header background and site name font**

In `components/Header.tsx`, change:
- `bg-ws-white` → `bg-ws-page` on the `<header>` element
- Add `font-[family-name:var(--font-display)]` to the site name Link

```tsx
import Link from 'next/link'

function MapleLeaf({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 512 512"
      className={className}
      style={{ fill: '#B71C1C' }}
    >
      <path d="M256 28l-30 56-30-18 12 90-68-12 24 58-42 18 78 74-14 36 80-14v106h20V316l80 14-14-36 78-74-42-18 24-58-68 12 12-90-30 18z" />
    </svg>
  )
}

export function Header() {
  const navLinkClass =
    'text-ws-muted text-[15px] font-medium no-underline hover:text-ws-black transition-colors focus-visible:outline-none focus-visible:bg-[var(--color-focus)] focus-visible:text-ws-white focus-visible:px-1'

  return (
    <header className="bg-ws-page border-b border-ws-border" role="banner">
      <div className="max-w-4xl mx-auto px-4 py-3 sm:py-5 flex items-center justify-between gap-3">
        <Link
          href="/"
          className="flex items-center gap-2 text-ws-black font-bold text-[18px] sm:text-[22px] tracking-tight no-underline hover:text-ws-accent focus-visible:outline-none focus-visible:bg-[var(--color-focus)] focus-visible:text-ws-white focus-visible:px-1 font-[family-name:var(--font-display)]"
        >
          <MapleLeaf className="w-5 h-5 sm:w-7 sm:h-7" />
          AI Today
        </Link>

        <nav aria-label="Main navigation">
          <ul className="flex gap-4 sm:gap-7 list-none m-0 p-0">
            <li><Link href="/issues" className={navLinkClass}>Issues</Link></li>
            <li><Link href="/about" className={navLinkClass}>About</Link></li>
          </ul>
        </nav>
      </div>
    </header>
  )
}
```

- [ ] **Step 3: Update Footer background**

In `components/Footer.tsx`, change `bg-ws-white` to `bg-ws-page` on the `<footer>` element:

```tsx
    <footer
      className="border-t border-ws-border mt-16 py-8 bg-ws-page"
      role="contentinfo"
    >
```

- [ ] **Step 4: TypeScript check**

```bash
npx tsc --noEmit 2>&1 | head -30
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add components/NeoPop/NeoPopCard.tsx components/Header.tsx components/Footer.tsx
git commit -m "feat(design): warm card/header/footer — cream bg, amber left stripe hero"
```

---

## Task 4: Homepage Typography

**Files:**
- Modify: `app/page.tsx`

- [ ] **Step 1: Apply display font to H1 and update latest issue label**

In `app/page.tsx`, make two changes:

1. Add `font-[family-name:var(--font-display)]` to the hero H1 (the `text-[36px]...` heading inside the hero `NeoPopCard`):

```tsx
          <h1 className="text-[36px] sm:text-[48px] lg:text-[56px] font-black leading-[0.95] tracking-tight mb-4 font-[family-name:var(--font-display)]">
            AI news for people who aren&apos;t AI people.
          </h1>
```

Note: remove `uppercase` from H1 — display serif looks better in title case.

2. The `Latest issue` label already uses `bg-ws-accent text-ws-white` — the amber token swap from Task 1 handles the color automatically. No explicit change needed here.

3. The past issues hover `group-hover:text-ws-accent` already works via the token swap. No change needed.

- [ ] **Step 2: TypeScript check**

```bash
npx tsc --noEmit 2>&1 | head -30
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add app/page.tsx
git commit -m "feat(design): display font on homepage hero H1"
```

---

## Task 5: Issue Page H1 Typography

**Files:**
- Modify: `app/issues/[date]/page.tsx`

- [ ] **Step 1: Apply display font to issue page H1 and update prev/next nav border**

In `app/issues/[date]/page.tsx`:

1. Add `font-[family-name:var(--font-display)]` to the issue H1, and remove `uppercase` (display serif doesn't need it):

```tsx
          <h1 className="text-[30px] sm:text-[40px] md:text-[52px] font-black leading-[1] sm:leading-[0.95] tracking-tight mb-4 mt-2 break-words font-[family-name:var(--font-display)]">
            {nonBreakingDate(issue.title)}
          </h1>
```

2. Update the prev/next nav border from brutalist to warm:

```tsx
          <nav
            aria-label="Issue navigation"
            className="border-t border-ws-border mt-12 pt-8 grid grid-cols-1 sm:grid-cols-2 gap-6 sm:gap-4"
          >
```

(Change `border-t-[3px] border-ws-black` → `border-t border-ws-border`)

- [ ] **Step 2: TypeScript check**

```bash
npx tsc --noEmit 2>&1 | head -30
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add "app/issues/[date]/page.tsx"
git commit -m "feat(design): display font on issue page H1, warm nav border"
```

---

## Task 6: Article Cards + Section Header in notion-renderer.tsx

**Files:**
- Modify: `lib/notion-renderer.tsx`

- [ ] **Step 1: Update `SectionHeader` — add display font to title**

In `lib/notion-renderer.tsx`, in the `SectionHeader` function, add `font-[family-name:var(--font-display)]` to the `<h2>`:

```tsx
        <h2 className="text-[28px] sm:text-[40px] font-black uppercase tracking-tight leading-[1] text-ws-white m-0 font-[family-name:var(--font-display)]">
          {label}
        </h2>
```

- [ ] **Step 2: Update `ArticleCard` — softer borders, warm shadows, amber hover, amber fill**

In the `ArticleCard` function, change the article shell (the outer `<article>` element) from the current brutalist style to a warm natural elevation:

Current:
```tsx
  return (
    <article className="h-full flex flex-col border-[2px] border-ws-black bg-ws-white hover:bg-ws-accent-light transition-colors duration-150">
```

Replace with:
```tsx
  return (
    <article className="h-full flex flex-col border border-ws-border bg-ws-white shadow-[0_2px_8px_rgba(28,25,23,0.07)] rounded-sm hover:shadow-[0_4px_16px_rgba(28,25,23,0.10)] hover:border-ws-accent/30 transition-[box-shadow,border-color] duration-150">
```

- [ ] **Step 3: Update no-image fills — amber-50 background**

There are two no-image fill blocks (one for hero, one for regular). Both use `bg-ws-accent-light`. Change both to `bg-amber-50`:

Hero no-image fill (inside `isHero` branch, `sm:h-full` div):
```tsx
              <div className="bg-amber-50 flex items-end p-5 aspect-[4/3] sm:h-full select-none overflow-hidden">
```

Regular no-image fill (inside the `else` branch):
```tsx
              <div className="bg-amber-50 flex items-end p-4 aspect-video select-none overflow-hidden">
```

- [ ] **Step 4: Update attribution hostname link color**

Both hero and regular variants have a hostname attribution footer. Update the link hover to use `text-ws-accent hover:text-ws-accent-hover`:

Find all occurrences of `className="hover:text-ws-accent"` in `ArticleCard` and change to:
```tsx
                  className="text-ws-muted hover:text-ws-accent transition-colors"
```

There are two such links (hero and regular). Change both.

- [ ] **Step 5: TypeScript check**

```bash
npx tsc --noEmit 2>&1 | head -30
```

Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add lib/notion-renderer.tsx
git commit -m "feat(design): warm article cards, amber fills, display font on section headers"
```

---

## Task 7: WizardStepBar Redesign — Proper Stepper

**Files:**
- Modify: `app/admin/_wizard-step-bar.tsx`

- [ ] **Step 1: Redesign WizardStepBar as a numbered stepper with connecting lines**

Replace the entire content of `app/admin/_wizard-step-bar.tsx`:

```tsx
'use client'

import type { StepKey } from './_constants'

export function WizardStepBar({
  steps,
  labels,
  activeStep,
  completedSteps,
  flashingStep,
  onStepClick,
}: {
  steps: readonly StepKey[]
  labels: Record<StepKey, string>
  activeStep: StepKey
  completedSteps: Set<StepKey>
  flashingStep: StepKey | null
  onStepClick: (step: StepKey) => void
}) {
  return (
    <div
      role="navigation"
      aria-label="Wizard steps"
      className="bg-[#1C1917] px-4 sm:px-6 py-4 flex items-center justify-center"
    >
      <div className="flex items-center w-full max-w-xl">
        {steps.map((step, i) => {
          const isDone     = completedSteps.has(step)
          const isActive   = step === activeStep
          const isFlashing = step === flashingStep
          const isLast     = i === steps.length - 1
          const isPast     = isDone || (completedSteps.size >= i && !isActive)

          return (
            <div key={step} className="flex items-center flex-1 last:flex-none">
              {/* Step */}
              <div className="flex flex-col items-center">
                <button
                  type="button"
                  onClick={() => onStepClick(step)}
                  aria-current={isActive ? 'step' : undefined}
                  className="flex flex-col items-center gap-1 group"
                >
                  {/* Circle */}
                  <div className={[
                    'w-8 h-8 rounded-full flex items-center justify-center text-[13px] font-black transition-all duration-150',
                    isFlashing
                      ? 'bg-ws-accent text-white animate-pulse'
                      : isActive
                        ? 'bg-ws-accent text-white'
                        : isDone
                          ? 'bg-white/20 text-white'
                          : 'border-2 border-white/20 text-white/30',
                  ].join(' ')}>
                    {isDone && !isActive ? '✓' : i + 1}
                  </div>
                  {/* Label */}
                  <span className={[
                    'hidden sm:block text-[11px] font-medium mt-0.5 whitespace-nowrap transition-colors',
                    isActive ? 'text-white' : isDone ? 'text-white/60' : 'text-white/30',
                  ].join(' ')}>
                    {labels[step]}
                  </span>
                </button>
              </div>
              {/* Connecting line */}
              {!isLast && (
                <div className={[
                  'h-px flex-1 mx-2 mb-5 sm:mb-5',
                  isDone ? 'bg-ws-accent/40' : 'bg-white/15',
                ].join(' ')} aria-hidden="true" />
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: TypeScript check**

```bash
npx tsc --noEmit 2>&1 | head -30
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add app/admin/_wizard-step-bar.tsx
git commit -m "feat(admin): stepper-style WizardStepBar with numbered circles + connecting lines"
```

---

## Task 8: Admin Wizard Footer + Sign-in Card Retheme

**Files:**
- Modify: `app/admin/page.tsx`

- [ ] **Step 1: Retheme the wizard nav footer buttons**

In `app/admin/page.tsx`, find the wizard nav footer section (around line 258-289). Replace the entire `{/* Wizard nav footer */}` block:

Current block starts with:
```tsx
          {/* Wizard nav footer */}
          <div className="flex items-center justify-between mt-8 pt-6 border-t-[2px] border-ws-black/15">
```

Replace the entire nav footer block with:
```tsx
          {/* Wizard nav footer */}
          <div className="flex items-center justify-between mt-10 pt-6 border-t border-ws-border">
            {/* Back */}
            {wizPrevStep ? (
              <button
                type="button"
                onClick={() => setActiveStep(wizPrevStep)}
                className="text-[14px] font-medium text-ws-muted hover:text-ws-black transition-colors"
              >
                ← Back
              </button>
            ) : <div />}

            {/* Continue / Complete */}
            {wizNextStep ? (
              <button
                type="button"
                onClick={() => handleStepDone(activeStep, wizNextStep, null)}
                className="bg-ws-accent text-white px-8 py-3 rounded-sm text-[15px] font-semibold hover:bg-ws-accent-hover hover:-translate-y-px transition-all duration-150"
              >
                Continue to {STEP_LABELS[wizNextStep]} →
              </button>
            ) : (
              <button
                type="button"
                onClick={() => handleStepDone(activeStep, null, null)}
                className="bg-ws-accent text-white px-8 py-3 rounded-sm text-[15px] font-semibold hover:bg-ws-accent-hover hover:-translate-y-px transition-all duration-150"
              >
                Complete workflow ✓
              </button>
            )}
          </div>
```

- [ ] **Step 2: Add display font to step title H2 and remove uppercase**

Find the step title H2 (around line 237):
```tsx
          <h2 className="text-[32px] sm:text-[40px] font-black uppercase tracking-tight leading-[0.95] mb-6">
```

Replace with:
```tsx
          <h2 className="text-[32px] sm:text-[40px] font-black tracking-tight leading-[0.95] mb-6 font-[family-name:var(--font-display)]">
```

- [ ] **Step 3: Retheme the sign-in card**

Find the sign-in card (around line 152):
```tsx
        <div className="border-[3px] border-ws-black bg-ws-white p-6 shadow-[8px_8px_0_0_var(--color-ws-black)]">
```

Replace with:
```tsx
        <div className="border border-ws-border bg-ws-white p-6 shadow-[0_2px_16px_rgba(28,25,23,0.08)] rounded-sm">
```

- [ ] **Step 4: Retheme sign-in input border**

Find the password input (around line 166):
```tsx
                className="border-[3px] border-ws-black px-3 py-3 text-[17px] font-mono w-full focus-visible:outline-none focus-visible:border-ws-accent disabled:bg-ws-page"
```

Replace with:
```tsx
                className="border border-ws-border rounded-sm px-3 py-3 text-[17px] font-mono w-full focus-visible:outline-none focus-visible:border-ws-accent transition-colors disabled:bg-ws-page"
```

- [ ] **Step 5: Retheme sign-in button**

Find the sign-in submit button (around line 172):
```tsx
              className="border-[3px] border-ws-black bg-ws-accent text-ws-white font-black uppercase tracking-wide text-[15px] px-5 py-3 self-start shadow-[4px_4px_0_0_var(--color-ws-black)] transition-[transform,box-shadow] duration-100 hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[2px_2px_0_0_var(--color-ws-black)] hover:bg-ws-accent-hover disabled:opacity-50 disabled:cursor-not-allowed"
```

Replace with:
```tsx
              className="bg-ws-accent text-white rounded-sm px-5 py-2.5 font-semibold text-[15px] self-start hover:bg-ws-accent-hover hover:-translate-y-px transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed"
```

- [ ] **Step 6: Add display font to sign-in H1**

Find the sign-in H1:
```tsx
        <h1 className="text-[48px] sm:text-[56px] font-black uppercase leading-[0.95] tracking-tight mb-3">
```

Replace with:
```tsx
        <h1 className="text-[48px] sm:text-[56px] font-black leading-[0.95] tracking-tight mb-3 font-[family-name:var(--font-display)]">
```

- [ ] **Step 7: Lighten the daily date header weight**

Find the date paragraph in the wizard body (around line 215):
```tsx
              <p className="text-[24px] sm:text-[30px] font-black uppercase tracking-tight leading-none">
```

Replace with:
```tsx
              <p className="text-[24px] sm:text-[30px] font-semibold tracking-tight leading-none">
```

- [ ] **Step 8: TypeScript check**

```bash
npx tsc --noEmit 2>&1 | head -30
```

Expected: no errors.

- [ ] **Step 9: Commit**

```bash
git add app/admin/page.tsx
git commit -m "feat(admin): warm sign-in card, large amber wizard nav buttons, display font on titles"
```

---

## Task 9: Final Build Verification

- [ ] **Step 1: Run full TypeScript check**

```bash
npx tsc --noEmit 2>&1
```

Expected: zero errors.

- [ ] **Step 2: Run Next.js build**

```bash
npm run build 2>&1 | tail -20
```

Expected: successful build, no errors. (Warnings about Notion token in preview env are expected and fine.)

- [ ] **Step 3: Commit and push branch for Vercel preview**

```bash
git push origin claude/charming-tesla-3f5aac
```

The Vercel preview deploy will run automatically. Verify the preview URL renders the warm aesthetic correctly.

---

## Spec Coverage Check

| Spec requirement | Covered by task |
|-----------------|-----------------|
| `ws-*` CSS variables → warm palette | Task 1 |
| DM Serif Display + DM Sans via next/font | Tasks 1 + 2 |
| NeoPopCard yellow → amber-50 + left stripe | Task 3 |
| NeoPopCard natural elevation (no brutal shadow) | Already implemented in prior commits |
| Header: cream bg, warm nav, display font on name | Task 3 |
| Footer: cream bg | Task 3 |
| Homepage H1: display font | Task 4 |
| Issue page H1: display font | Task 5 |
| Issue page prev/next nav: warm border | Task 5 |
| Section header: display font on title | Task 6 |
| Article card: soft border + shadow (not brutal) | Task 6 |
| Article card: no-image fill → amber-50 | Task 6 |
| Article card: attribution link hover → amber | Task 6 |
| WizardStepBar: proper stepper | Task 7 |
| Admin wizard nav: large amber "Continue to X →" | Task 8 |
| Admin wizard step title: display font | Task 8 |
| Admin date header: lighter weight, drop uppercase | Task 8 |
| Admin sign-in: softer card + input + button | Task 8 |
| Admin sign-in H1: display font | Task 8 |
| All ws-* class names retained | All tasks (token swap only) |
| TOC anchor IDs preserved | Not touched (SectionHeader unchanged) |
| Mobile responsiveness preserved | Not touched (no layout changes) |
