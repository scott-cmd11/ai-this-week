# Task: Publish Workflow Fixes

- [x] Trace why "Complete workflow" does nothing.
- [x] Fix the root cause with the smallest safe change.
- [x] Add a way to add articles/events to an existing published issue outside the wizard workflow.
- [x] Verify the behavior with available tests/build/browser checks.

## Review

- Root cause: the final wizard button only updated internal completed-step state. Because there was no next step and no final-state UI, the click produced no visible change.
- Fix: completing the last step now shows a workflow-complete panel and swaps the footer action to "View all sections."
- Added a "Published issue updates" panel in the Publish step and the full admin view. It loads published issues, lets the editor choose one, and reuses the article/event forms against that selected issue.
- API support: `/api/capture` and `/api/capture-event` now accept an admin-only `targetIssueId`, append to the selected Notion issue, and revalidate the public site tree after published-issue updates.
- Verification: targeted lint on changed files passed, TypeScript passed, and the Vitest suite passed. Full lint still fails on pre-existing files outside this change. Full build compiles and type-checks, then stops prerendering `/issues` because local `NOTION_TOKEN` is not set.

# Task: May 4 Did Not Publish From Final Wizard Step

- [x] Trace how today's issue is supposed to publish.
- [x] Identify why completing the final step did not publish May 4.
- [x] Move the publish action into the actual Publish step.
- [x] Verify changed files and document limits.

## Review

- Root cause: in wizard mode, the actual `Publish now` control lived in the previous Review Draft step. The final Publish step only showed published-issue/older-draft tools plus `Complete workflow`, so May 4 could be marked complete without setting `Published=true`.
- Fix: the Review Draft step now hides the publish action and says publishing happens in the next step. The Publish step now shows today's draft with `Publish now`.
- Guardrail: `Complete workflow` is disabled while today's draft still exists with articles and says `Publish today's issue first`.
- Verification: targeted lint on changed files passed, TypeScript passed, and Vitest passed.

# Task: May 4 Duplicate Contents Sections

- [x] Trace the issue table of contents source.
- [x] Identify why May 4 shows duplicate sections.
- [x] Prevent future duplicate section headings from repeated imports.
- [x] Collapse duplicate section headings in the public renderer/TOC.

## Review

- Root cause: the public TOC is generated from every Notion `heading_2` block. The May 4 issue has duplicate category heading blocks, likely from rerunning imports while the issue remained unpublished.
- Fix: capture/import now inserts new articles and events into existing sections instead of writing another `## Canada`, `## Policy & Regulation`, etc. cycle.
- Public rendering now merges duplicate section chunks by heading label and de-duplicates TOC entries by label, so May 4 does not display two identical section runs.
- Verification: targeted lint passed, TypeScript passed, and Vitest passed.

# Task: Prevent Truncated Imported Titles

- [x] Define a title-quality guardrail.
- [x] Prefer canonical source-page titles during briefing import.
- [x] Surface import-time title warnings in the admin panel.
- [x] Surface draft title warnings before publishing.
- [x] Verify targeted lint, TypeScript, and tests.

## Review

- Added `lib/title-quality.ts` for detecting dangling/truncated titles such as headlines ending in `and`, `to`, `of`, etc.
- Briefing imports now compare briefing title text with fetched source metadata and use the canonical source title when the briefing title looks incomplete or meaningfully shorter.
- Import results now show a "Review title changes" warning when the importer corrected suspicious title text.
- Today's Draft now shows a "Review title warnings before publishing" banner if any saved title still looks truncated.
- Verification: targeted lint passed, TypeScript passed, and Vitest passed.

# Goal: Admin Wizard Daily Flow Review

- [x] Audit the current wizard sequence as a daily publishing flow.
- [x] Identify confusing labels, misplaced actions, and false-complete states.
- [x] Patch the admin wizard so the process is intuitive.
- [x] Verify with targeted lint, TypeScript, tests, and local browser render checks.

## Review

- Renamed wizard steps to action-oriented labels: Import Articles, Add Research, Add Events, Review Issue, Publish & Refresh.
- Added step help text so each wizard screen explains what belongs there and what comes next.
- Aligned full admin mode with wizard mode: Review Issue no longer contains the publish button; Publish & Refresh is the only daily publish step.
- Added a clear note separating "publish today's issue" from "already-live issue updates."
- Guarded both wizard and full admin completion so the workflow cannot be marked done while today's draft still has unpublished articles.
- Verification: targeted ESLint passed, TypeScript passed, Vitest passed, and the local admin sign-in page rendered on `http://127.0.0.1:3023/admin`. The protected wizard itself was not clicked through because local admin/Notion secrets are not loaded in this workspace.

# Task: Homepage Brand Repetition Cleanup

- [x] Reduce repeated "AI Today" text on the homepage.
- [x] Simplify the latest-issue area so the page feels calmer.
- [x] Verify lint/build and local render.

## Review

- Replaced the repeated homepage masthead with a descriptive H1: "A plain-English briefing for people tracking Canadian AI."
- Removed the busy editor's-desk / coverage sidebar from the latest issue section.
- Latest and previous issue links now display date-only titles instead of repeating "AI Today - May ...".
- Fixed local preview instability by keeping the existing Turbopack root pinned to this app folder in `next.config.ts`.
- Verification: `npx eslint app/page.tsx next.config.ts` passed, `npx tsc --noEmit` passed, `npm run build` passed, and `http://127.0.0.1:3027/` returned HTTP 200 with the simplified homepage HTML.

# Task: Issues Archive Repetition Cleanup

- [x] Remove repeated brand/date text from issue archive rows.
- [x] Make the archive page heading and intro more professional.
- [x] Verify targeted lint, TypeScript, and local archive response.

## Review

- The archive page now uses "Previous briefings" instead of "All Issues".
- Issue cards now show the issue number plus a clean date title, without repeating the brand or duplicating the date on the right.
- The issue list uses one continuous ruled list instead of separated repeated cards.
- Verification: targeted ESLint passed, TypeScript passed, and `http://127.0.0.1:3027/issues` returned HTTP 200.

# Task: Homepage Editorial Graphic

- [x] Generate a restrained homepage visual asset.
- [x] Add the graphic to the homepage hero.
- [x] Verify lint, TypeScript, build, and local homepage response.

## Review

- Generated a restrained editorial bitmap using the built-in image generation path.
- Saved the project asset at `public/images/homepage-signal-map-v2.png`.
- Added it to the homepage introduction as a restrained Signal desk strip with accessible alt text.
- Verification: `npx eslint app/page.tsx` passed, `npx tsc --noEmit` passed, `npm run build` passed, and `http://127.0.0.1:3027/` returned HTTP 200 with the image reference present.

# Task: AI Today Visual System Direction

- [x] Define a broader visual system direction.
- [x] Add one reusable pattern to start applying it in code.
- [x] Verify lint, TypeScript, build, and local homepage response.

## Review

- Added `docs/visual-system.md` to define the "Signal desk" direction: calm, sourced, Canadian, ruled metadata, restrained data/document/map graphics, and minimal brand repetition.
- Added `components/SignalLedger.tsx` as the first reusable pattern for issue state, publishing rhythm, and editorial standard.
- Updated the homepage latest-issue block to use the Signal Ledger instead of scattered metadata lines.
- Verification: targeted ESLint passed, TypeScript passed, `npm run build` passed, and `http://127.0.0.1:3027/` returned HTTP 200 with the Signal Ledger and hero image present.

# Task: Issue Page Briefing File Format

- [x] Make issue pages date-led instead of repeating the brand in the headline.
- [x] Replace scattered metadata and stats with the Signal Ledger pattern.
- [x] Simplify the issue signal graphic so it supports the article instead of competing with it.
- [x] Make previous/next issue navigation date-led.
- [x] Verify lint, TypeScript, build, and local issue response.

## Review

- The issue page now presents as a briefing file: date-led H1, compact metadata ledger, editorial summary, and a quieter signal map.
- Section counts now use unique section labels so duplicated Notion headings do not show as duplicated totals.
- Previous/next issue links now display date-led titles rather than repeating the brand.
- Verification: targeted ESLint passed, TypeScript passed, `npm run build` passed, and `http://127.0.0.1:3027/issues/2026-05-04` returned HTTP 200 with `May 4, 2026`, `Issue 04`, `53 stories / 6 sections`, and `Signal map`.
