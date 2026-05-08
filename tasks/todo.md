# Task: Pre-Publish Article Review Visibility And Duplicates

- [x] Trace why saved draft articles can be missing from Today's Draft review.
- [x] Fix draft review parsing so it reads the full Notion draft.
- [x] Strengthen duplicate-subject detection before import/publish.
- [x] Verify with targeted tests, TypeScript, and lint.

## Review

- Root cause for hidden review articles: `/api/today-draft` only read the first Notion child-block page. Long issues can exceed 100 blocks, so later articles existed in Notion but did not appear in Today's Draft review.
- Fix: `/api/today-draft` now paginates through all Notion child blocks and parses the full draft through a shared `parseDailyArticles` helper.
- Root cause for duplicate subjects: duplicate protection was strongest for exact/normalized URLs. Similar-title detection existed in the admin import UI, but the server import path did not enforce it and same-batch subject duplicates could still be selected.
- Fix: title similarity now lives in `lib/title-dedupe.ts`, the UI pre-unchecks same-batch similar subjects, and `/api/import-briefing-articles` skips similar subjects from recent issues or earlier in the same import batch.
- Verification: targeted tests passed, targeted ESLint passed, TypeScript passed, and the full Vitest suite passed.

# Task: Website Workflow Diagram

- [x] Inspect the actual website routes and admin workflow.
- [x] Create an editable Excalidraw workflow diagram.
- [x] Validate the Excalidraw file.

## Review

- Created `docs/ai-today-workflow.excalidraw`, showing the source-input lane, admin production workflow, Notion draft/publish state, live-issue update path, Vercel cron notes, and public reader outputs.
- Validation passed with the Excalidraw skill validator.

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

# Task: Daily Import Date Drift

- [x] Trace why the admin header showed May 5 while briefing import queried May 6.
- [x] Add one shared publication-timezone issue date helper.
- [x] Use the helper in briefing imports, research imports, draft lookup, daily assemble, daily publish, and capture-to-draft writes.
- [x] Verify targeted lint, TypeScript, local API date, and build.

## Review

- Root cause: server routes used UTC ISO dates, so evening Central/Winnipeg admin sessions could roll the import date to tomorrow.
- Fix: daily issue routes now default to `America/Winnipeg` via `issueDateFor()`.
- Verification: `/api/briefing-sources` returned `2026-05-05` locally during the May 5 evening session, targeted ESLint passed, TypeScript passed, and `npm run build` passed.

# Task: Briefing Import Row Selection And Topic Duplicates

- [x] Trace why unchecking one article could uncheck a whole source group.
- [x] Make imported article row keys unique even when source URLs are generic or duplicated.
- [x] Extend duplicate checks to recent issue titles/topics, not only exact URLs.
- [x] Pre-uncheck similar-title repeats such as Sanofi and show the matching prior issue.
- [x] Verify build and deploy.

## Review

- Root cause: some briefing rows only provided a generic source homepage URL, such as `http://newswire.ca/`, so multiple articles shared the same checkbox key.
- Fix: import rows now use a row-specific key based on source, section, index, title, and URL.
- Duplicate guardrail: `/api/known-urls` now also returns recent issue article titles, and the admin import UI flags similar titles as "Already covered."
- Verification: targeted ESLint passed, TypeScript passed, `/api/known-urls` returned recent Sanofi titles for matching, and `npm run build` passed.

# Task: Hide Internal Repair Notes

- [x] Identify why the public issue showed a Repair Note.
- [x] Filter internal operational sections out of public issue rendering.
- [x] Verify the May 5 issue no longer renders the note.
- [x] Verify lint, TypeScript, and build.

## Review

- Root cause: the Notion issue contained a `Repair Note` heading, and the public renderer treated every `heading_2` as a reader-facing section.
- Fix: issue pages now filter internal sections such as `Repair Note`, `Internal Note`, and `Ops Note` before building the TOC, stats, markdown export, and visible body.
- Verification: `http://127.0.0.1:3027/issues/2026-05-05` returned 200 without `Repair Note`, targeted ESLint passed, TypeScript passed, and `npm run build` passed.

# Task: Published Issue Editing Flow

- [x] Review the current admin wizard and identify why live issue updates feel hidden.
- [x] Add a dedicated published-issue editing step to the wizard and full console.
- [x] Let editors update existing published item titles/summaries through the site.
- [x] Keep late article/event additions in the same live-issue editing step.
- [x] Verify lint, TypeScript, build, tests, and local admin response.

## Review

- Root cause: the existing "Published issue updates" tool worked, but it was repeated as a side panel above the daily workflow instead of being a named step in the process.
- Added a sixth workflow step, "Edit Live Issue", after "Publish & Refresh" in both wizard and full admin modes.
- Added a live issue editor that lists existing published issue items by section and lets editors update story titles/summaries through the site.
- Kept late article/event additions in the same live issue desk, sharing the selected published issue instead of forcing a separate hidden picker.
- Verification: targeted ESLint passed, TypeScript passed, `npm run build` passed, `npm run test` passed, `/admin` returned 200 locally, and `/api/published-issue-items` returned 401 without admin auth.

# Task: Live Issue Remove Action

- [x] Track the full Notion block group for each live issue item.
- [x] Add a protected API route to remove an item from a published issue.
- [x] Add an inline confirmed remove action to each live issue desk item.
- [x] Verify lint, TypeScript, build, tests, and local protected endpoint response.

## Review

- Each live issue item now carries its full Notion block group, so removal archives the title, summary, source link, image, and divider together.
- Added `/api/remove-published-item`, protected by admin auth and limited to published issues.
- Added an inline Remove action on each live desk row with a second confirmation before the item is removed.
- Verification: targeted ESLint passed, TypeScript passed, `npm run build` passed, `npm run test` passed, `/admin` returned 200 locally, and `/api/remove-published-item` returned 401 without admin auth.

# Task: May 6 Extra Articles Investigation

- [x] Confirm what is visible on the live issue.
- [x] Trace whether extra stories came from rendering, Notion, cron, or admin import.
- [x] Patch the approval/import flow guardrail.
- [x] Verify focused checks.

## Review

- Root cause evidence: the May 6 Notion issue had a first batch at 2026-05-07 00:24 UTC, then a second import wave at 2026-05-07 02:56-03:12 UTC. Vercel logs show POST /api/import-briefing-articles at 22:10 Winnipeg time and POST /api/publish-issue at 22:17, so the extras were appended before publish by a second import pass.
- Fix: the briefing import panel still preselects fresh candidates for an empty daily draft, but once today's draft already has articles, refreshes leave the remaining briefing items unchecked and show an explanatory note. This prevents a second import from treating every leftover candidate as approved.
- Verification: `npx eslint app/admin/_briefing-import.tsx`, `npx tsc --noEmit`, and `npm run test` passed.


# Task: AI Canada Pulse Cross-Link

- [x] Add a persistent public link to AI Canada Pulse.
- [x] Add a short explanatory About-page panel.
- [x] Verify lint, TypeScript, and build.

## Review

- Added a footer mention linking to https://www.aicanadapulse.ca/ as a companion project for deeper Canadian AI adoption, policy, infrastructure, and public-sector signals.
- Added an About-page related-project panel explaining the difference between AI Today as the daily briefing and AI Canada Pulse as the wider Canadian AI dashboard.
- Verification: `npx eslint app/about/page.tsx components/Footer.tsx`, `npx tsc --noEmit`, and `npm run build` passed.


# Task: Usage Tracking System

- [x] Inspect existing analytics and admin stats surfaces.
- [x] Add privacy-conscious usage events for public pages and key interactions.
- [x] Surface usage-tracking guidance in admin.
- [x] Verify lint, TypeScript, tests, and production build.

## Review

- Existing state: Vercel Analytics was already mounted globally, but the admin stats panel only counted editorial inventory, not reader usage.
- Added `UsageTracker`, which records Vercel custom events for public page views by page type, issue link clicks, outbound source clicks, AI Canada Pulse referrals, and issue tool usage.
- Kept admin activity out of public usage events.
- Surfaced the existing admin overview panel in the main admin console and added direct Vercel Analytics guidance.
- Verification: focused ESLint passed, `npx tsc --noEmit` passed, `npm run test` passed, and `npm run build` passed.

