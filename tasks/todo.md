# Task: Expert Site and Publishing Flow Audit

## Audit Status

- [x] Read `AGENTS.md`, `docs/visual-system.md`, `tasks/lessons.md`, `package.json`, public route files, admin route files, cron routes, and issue-store/readiness files.
- [x] Start the local site on `http://localhost:3035`.
- [x] Check local route health for `/`, `/issues`, `/sections`, `/about`, `/contact`, `/capture`, and `/admin`.
- [x] Confirm current local issue-store limitation: `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are missing locally, so public issues/archive render empty and known issue URLs 404 in local QA.
- [x] Review the publishing flow from candidate intake through draft edit, readiness checks, cron assemble, cron publish, and Supabase public rendering.
- [x] Get user approval before implementation.
- [x] Implement approved P0/P1 improvements only.
- [x] Validate with lint, tests, build, TypeScript, and local smoke checks after implementation.

## Expert Review

AI Today has a strong core direction: it feels more like a Canadian public-interest briefing desk than a generic AI/news product. The homepage, issue page, footer, and admin visual system have already moved toward a coherent editorial product with warm paper, ruled structure, maple red, serif hierarchy, and operational density.

The remaining opportunity is not a broad redesign. The highest-value work is to make the experience feel complete at every task boundary: archive browsing should have the same editorial confidence as the homepage, capture/admin utility pages should stop showing older visual language, and the guided admin workflow should remove placeholder/dead-end moments from the main daily path.

The backend is structurally healthier than the old Notion publishing model: Supabase is the issue source of truth, Winnipeg issue dates are centralized, and publish readiness is recalculated server-side. The biggest reliability gap for this audit is QA visibility: the local checkout cannot currently render real published issues because the Supabase issue-store env is absent, so issue-page visual QA is only partial unless a safe read-only issue-store target is configured or the user approves live read-only verification.

## Site Map

- Public reader surfaces: `/`, `/issues`, `/issues/[date]`, `/sections`, `/sections/[section]`, `/about`, `/contact`, `/feed.xml`, `/sitemap.xml`, `/robots.txt`.
- Utility/editor surfaces: `/capture`, `/admin`.
- Admin workflow APIs: `/api/admin/today-status`, `/api/article-candidates`, `/api/import-briefing-articles`, `/api/today-draft`, `/api/publish-issue`, `/api/append-to-issue`, `/api/published-issue-items`.
- Scheduled jobs: `/api/cron/daily-assemble` at `23:00 UTC` and `/api/cron/daily-publish` at `02:00 UTC`, which is currently documented as the evening Winnipeg publishing window.

## Admin Workflow Map

1. Source automation and manual/RSS intake add article candidates or draft items.
2. `/admin` signs in against `/api/admin/today-status`.
3. Guided flow opens on Status, then moves through Intake, Choose, Edit, Check, and Publish.
4. Candidate triage keeps/rejects/holds items; Keep imports to today's draft through `/api/import-briefing-articles`.
5. Draft editor reviews and edits the assembled issue.
6. Publish checks surface blockers and warnings from shared readiness logic.
7. `/api/publish-issue` recalculates readiness server-side and publishes the Supabase issue if checks pass.
8. Full Desk contains secondary work: Issue Desk, Future Queue, Health, Settings, live issue edits, append flow, and legacy fallback imports.

## Reader-Facing Findings

- **P0: Local published-issue QA is blocked by missing issue-store env.** The local site returns `200` for public routes, but `/` and `/issues` show no published issues and `/issues/2026-05-11`, `/issues/2026-05-12`, and `/issues/2026-05-08` return `404`. This prevents reliable local visual QA of the most important reader surface.
- **P1: Archive and section pages feel thinner than the homepage/issue page.** `/issues` and `/sections` are usable, but they do not yet feel as editorially resolved as the homepage. They could better use the "signal desk" language: counts, section context, issue rhythm, and stronger empty states.
- **P1: Capture page still uses older high-contrast utility styling.** `/capture` visually diverges from the calmer admin system, and the source contains garbled characters in comments/string-adjacent text from prior encoding issues. It works as a tool, but it feels less like part of the same 2026 product.
- **P1: Contact page is clear but generic.** The H1 is simply "Contact"; it could better carry the corrections/tips/source-suggestion job and reinforce trust without adding noise.
- **P2: Header navigation is minimal.** It intentionally stays quiet, but `/sections`, `/contact`, and RSS/feed discovery are not surfaced in the primary nav. This may be fine, but should be an explicit product choice.

## Admin and Task-Flow Findings

- **P0: Guided Intake step is still a placeholder.** The main daily flow includes an "Intake" step that says controls arrive later, while real candidate review lives in "Choose". This creates a dead-end in the primary workflow and undermines confidence.
- **P1: Status and Choose overlap conceptually.** Status tells the editor to review candidates, but the step rail splits Intake and Choose in a way that makes source intake, candidate triage, and draft assembly feel less crisp than the underlying system actually is.
- **P1: Secondary Health and Future Queue are still mostly explanatory shells.** Full Desk is organized well, but Health says diagnostics are a follow-up and Future Queue is not a full board. This should either be tightened as explicit "not yet" copy or turned into useful read-only status.
- **P1: Admin auth/local status QA is awkward.** A local read-only call to `/api/admin/today-status` returned `401` using the parsed local env value, which means the status flow needs a clearer local verification path before implementation QA.
- **P2: Publish readiness labels are accurate but clinical.** The checks are strong; the presentation could better tell the editor what to do next for each blocker/warning without weakening the guardrails.

## Backend and Reliability Findings

- **P0: Local QA parity depends on absent Supabase env.** The app degrades safely to empty public issues when Supabase is not configured, but the repo needs a documented read-only QA path or fixture strategy to verify issue pages locally.
- **P1: Cron status is inferred, not actually observed in the admin status summary.** `getAdminRunSummaries()` currently returns `lastRunAt: null` and approximates automation failure from candidate-store errors. The Status card can say "Needs check" even when the real cron/import path may be fine.
- **P1: `daily-publish` has fewer readiness gates than manual publish.** Manual publish uses shared readiness checks and warning acknowledgement. Cron publish currently checks only draft existence, published state, and article count before publishing. That may be intentional automation policy, but it should be reviewed because it can bypass the richer readiness model.
- **P1: Revalidation is broad but not always specific.** Several write paths call `revalidatePath('/', 'layout')`; some item update/remove paths also revalidate issue/archive paths. The audit should confirm whether all public/RSS/sitemap surfaces refresh predictably after publish, append, edit, remove, and archive.
- **P2: Legacy Notion naming remains in types, renderer names, and some comments.** This is not urgent because the block contract still evolved from Notion, but product-facing/admin copy should avoid implying Notion is still the publishing source of truth except where it is truly an input fallback.

## Proposed Implementation Plan

- [x] **P0: Remove the guided-flow dead end.** Replace the Intake placeholder with a useful source/intake status panel or merge the step meaning into Candidate Triage so the primary admin path has no "coming next" section.
- [x] **P0: Establish a safe issue-page QA path.** Add a documented read-only local verification option or a small fixture/dev fallback that lets `/`, `/issues`, and `/issues/[date]` be smoke-checked without production mutation.
- [x] **P1: Bring `/capture` onto the admin visual system.** Keep behaviour intact, but replace the older heavy-border/shadow style with the shared admin panel/input/button primitives and fix visible text encoding if any appears at runtime.
- [x] **P1: Strengthen archive and section surfaces.** Add compact editorial context, counts/metadata when available, stronger empty states, and section descriptions without turning them into card-heavy pages.
- [x] **P1: Clarify admin Health/Future Queue.** Either make them useful read-only status views or make the copy explicitly say where the working controls live today.
- [x] **P1: Review cron publish parity.** Decide whether scheduled publish should use the same blocker model as manual publish. If yes, add shared readiness enforcement; if no, document the intentional policy in code/admin copy.
- [x] **P2: Tune contact and footer microcopy.** Make corrections/tips/source submissions feel more official and source-trust aligned.

## Validation Plan

- `npm run lint`
- `npm test`
- `npm run build`
- `npx tsc --noEmit` after build if `.next/types` needs regeneration
- Local route checks: `/`, `/issues`, one real or fixture-backed `/issues/[date]`, `/sections`, `/about`, `/contact`, `/capture`, `/admin`
- Read-only admin/API checks only unless write-path testing is explicitly approved
- Desktop and mobile browser checks for the changed surfaces when browser tooling is available

## Non-Goals During Implementation

- No push, deploy, Vercel changes, or live production mutation before explicit approval.
- No secret changes or credential display.
- No Supabase schema migration unless explicitly approved.
- No broad visual rebrand away from the current AI Today editorial system.
- No destructive publish, append, archive, remove, or live-edit testing.

## Implementation Review

- Added `lib/sample-issues.ts` and a dev-only sample issue fallback in `lib/issue-store.ts` so local public QA can render `/`, `/issues`, `/issues/2026-05-12`, `/sections`, and `/sections/canada` without Supabase issue-store credentials. Production remains unchanged because the fallback is disabled when `NODE_ENV` is `production`.
- Documented the local sample toggle in `.env.local.example` with `AI_TODAY_DISABLE_SAMPLE_ISSUES`.
- Replaced the guided admin Intake placeholder with a real read-only source-intake panel showing automation, candidate, and draft state plus direct next-step actions.
- Clarified Full Desk Future Queue and Health panels with concrete operating notes so they no longer read like unfinished placeholders.
- Rebuilt `/capture` on the shared admin visual system while preserving token setup, article capture, duplicate warning, optional image URL, success, reset-token, and add-another behaviour.
- Strengthened `/issues`, `/sections`, `/sections/[section]`, and `/contact` with calmer editorial context, metadata ledgers, counts, descriptions, and stronger source/correction language.
- Changed `/api/cron/daily-publish` so scheduled publishing uses the same readiness model as admin status and skips auto-publish when blockers or warnings exist.

## Validation Results

- `npm run lint` passed.
- `npm test` passed: 13 test files, 58 tests.
- `npm run build` passed.
- `npx tsc --noEmit` passed.
- `git diff --check` passed.
- Local smoke checks on `http://localhost:3035` passed for `/`, `/issues`, `/issues/2026-05-12`, `/sections`, `/sections/canada`, `/about`, `/contact`, `/capture`, and `/admin`.
- The local sample issue page check confirmed `/issues/2026-05-12` returns `200` and renders sample issue content without Supabase issue-store credentials.

## Remaining Notes

- Implementation avoided live production mutation, secret changes, Supabase schema migration, and destructive write-path testing. Push/deploy is only being performed after explicit user approval.
- Browser screenshot automation was not available in this environment, so verification used route-level smoke checks and rendered HTML evidence.
- Cron publish is now intentionally conservative: warnings block scheduled auto-publish and require a manual editor review/publish path.

# Task: Replace Notion Publishing Layer

- [x] Map the current draft, publish, append, and public-render paths.
- [x] Design the smallest Supabase-backed issue model that can replace Notion for final/draft publishing.
- [x] Add database schema and storage helpers.
- [x] Move admin publish/draft APIs onto the new store while preserving current UI behaviour.
- [x] Move public issue rendering/archive/feed paths onto the new store.
- [x] Verify May 9 issue workflow locally and with tests.
- [x] Document rollout steps and remaining Notion cleanup.

## Review

- Added `public.issues` Supabase schema for draft and published issues.
- Added `lib/issue-store.ts` as the new issue source of truth, preserving the existing `Issue` and block-array rendering contract.
- Repointed public home/archive/issue/section/feed/sitemap reads to Supabase.
- Repointed draft import, manual capture, event capture, publish, older draft deletion, stats, duplicate checks, live issue item edits, and cron publish to Supabase.
- Kept Notion as an input source only for briefing/research/contact/legacy routes that are not the final issue state owner.
- Added `scripts/migrate-notion-issues-to-supabase.mjs` to copy existing Notion issues into Supabase before deployment.
- Verification passed: TypeScript, ESLint, targeted Vitest, production build, and migration dry-run against the current Notion issue database.
- Migration dry-run found 8 published issues from 2026-05-01 through 2026-05-08 and no current Notion draft.
- `docs/supabase/issues.sql` was applied in Supabase and the migration script moved 8 published issues into `public.issues`.
- Shipped to production at `https://aitoday.vercel.app`; live checks passed for archive, May 8 issue page, feed, sitemap, admin, published-issues API, candidate inbox, and today-draft API.

# Task: Reduce Admin Review Friction

- [x] Make the focused admin workflow load only the active step.
- [x] Put Supabase Candidate Inbox forward as the primary review path.
- [x] Move legacy Notion briefing import out of the main daily path.
- [x] Make candidate actions read as review decisions, not competing workflows.
- [x] Remove Notion-only draft regeneration from the Supabase draft review UI.
- [x] Verify lint/build and record the result.

## Review

- Focused admin mode now mounts only the active step, which cuts the first review screen down to the candidate workflow instead of loading every admin panel at once.
- Candidate Inbox is now the primary daily review path, with per-item "Add to draft" and bulk "Add selected to draft" actions.
- Legacy Notion briefing import is tucked behind an explicit fallback panel in the all-sections view.
- Draft review no longer exposes the old Notion-backed annotation regeneration action.
- Verification passed: ESLint, targeted Vitest candidate/draft tests, production build, and a local browser check of `/admin`.

# Task: Add Separate Issue Append Flow

- [x] Allow article/event append API to target drafts, published issues, or an issue date.
- [x] Create upcoming draft shells when adding to a future issue date.
- [x] Build a standalone admin "Add to Issue" desk.
- [x] Keep the daily candidate review flow separate from issue append/scheduling.
- [x] Verify lint, tests, build, and local admin behaviour.

## Review

- Added an admin "Issue append desk" outside the daily workflow for articles and learning events.
- The desk can target an existing draft, an existing published issue, or a date that creates/fetches that issue draft.
- Updated `/api/append-to-issue` so it no longer only accepts published issues.
- Added `findOrCreateDraftByDate` to create future issue shells when needed.
- Verification passed: ESLint, targeted Vitest tests, production build, and a local browser smoke check of the new admin desk. Local Supabase env is not configured, so the browser check verified UI loading rather than live issue data.

# Task: Strengthen Duplicate Topic Checks

- [x] Add issue-memory matching for likely same stories and related topics.
- [x] Apply issue-memory warnings to article/event append API.
- [x] Show actionable warnings in admin append flows with an explicit override.
- [x] Add tests for similar-story and related-topic warnings.
- [x] Verify lint, tests, and build.

## Review

- Added `lib/issue-memory.ts` to flag likely same stories and related topics from recent issue titles.
- `/api/append-to-issue` now checks the last 90 days of issue titles before appending articles or events.
- Add-to-issue admin surfaces now show "Issue memory warning" with matched title, issue reference, shared signals, and an explicit add-anyway override.
- Verification passed: issue-memory/title tests, ESLint, and production build.

# Task: Replace Admin Page With Daily Run Shell

- [x] Create the status summary component backed by `/api/admin/today-status`.
- [x] Create the guided/full daily run shell with temporary placeholder sections.
- [x] Simplify the authenticated admin page branch to render the new shell.
- [x] Verify lint and the targeted admin-readiness tests.
- [x] Smoke `/admin` locally without mutating data.
- [x] Self-review owned-file changes and commit locally.

## Review

- Added `_today-run-status.tsx` for the Task 2 status payload, including optional candidate inbox errors.
- Added `_daily-run-shell.tsx` with guided/full modes, daily step navigation, status reloads, and placeholder areas for later tasks.
- Simplified `app/admin/page.tsx` so auth/session storage remains in place and the authed branch renders `DailyRunShell`.
- Verification passed: `npm run lint`, `npm run test -- tests/lib/admin-readiness.test.ts`, `npx tsc --noEmit`, and a read-only local `/admin` plus `/api/admin/today-status` smoke check on port 3034.

# Task: Organize Secondary Admin Areas

- [x] Create the secondary admin tabs client component.
- [x] Wire full desk mode to the real secondary tabs instead of the placeholder.
- [x] Verify lint, targeted readiness test, TypeScript, and a read-only admin smoke check if practical.
- [x] Self-review owned-file changes and commit locally.

## Review

- Added `_secondary-admin-tabs.tsx` with Issue Desk, Future Queue, Health, and Settings tabs.
- Full desk mode now renders the secondary tabs instead of the placeholder.
- Verification passed: `npm run lint`, `npm run test -- tests/lib/admin-readiness.test.ts`, `npx tsc --noEmit`, and `git diff --check`.
- Browser smoke was attempted against local `/admin` on port 3034, but local/transient Playwright tooling was unavailable.

# Task: Guided Daily Run Admin Rebuild

- [x] Add readiness model and today-status API.
- [x] Replace admin default with Today's Run Status and guided daily run shell.
- [x] Add Keep/Reject/Hold candidate triage.
- [x] Add draft split editor MVP.
- [x] Add blocker/warning publish readiness gate.
- [x] Organize secondary admin areas.
- [x] Verify lint, targeted tests, production build, local admin route, and read-only admin APIs.

## Review

- Admin now opens on Today's Run Status after sign-in and leads the editor through Status, Intake, Choose, Edit, Check, and Publish.
- Candidate review uses Keep, Reject, and Hold, with safeguards against false imported status when an import is skipped.
- Draft editing has a structured editor with a reader preview and manual article/event add controls.
- Publish is guarded by blockers, warning acknowledgement tied to the current checks, and refresh-state protection to avoid stale publish decisions.
- Secondary tools are grouped under Issue Desk, Future Queue, Health, and Settings.
- Verification passed: `npm run lint`, `npm run test -- tests/lib/admin-readiness.test.ts tests/lib/issue-memory.test.ts tests/lib/title-dedupe.test.ts tests/lib/draft-articles.test.ts`, and `npm run build`.
- Read-only local checks passed for `/admin`, `/api/admin/today-status`, and `/api/today-draft` on port 3034. No publish or live data mutation was performed.
- Full visual browser automation was not available in this environment; this should be repeated before production deployment if a browser tool is available.
- Follow-up review tightened the publish path so `/api/publish-issue` recalculates readiness server-side, blocks unresolved blockers, and requires a current warning acknowledgement fingerprint before publishing.
- The status API now uses the same readiness calculation as publishing, so duplicate URLs, stale sources, weak titles, broken URLs, missing summaries, and missing images cannot drift between the admin view and the final publish action.
- Final review found one parity gap: publish also needed the same candidate and automation warning snapshot as the admin status screen. That snapshot is now shared by both routes.

# Task: Add Issue Summary Fallback

- [x] Add a reusable summary fallback based on issue sections and article titles.
- [x] Use the fallback on the homepage latest issue card.
- [x] Use the fallback on issue detail pages and metadata.
- [x] Add focused tests for the summary fallback.
- [x] Verify lint, tests, and production build.

## Review

- Added `deriveIssueSummary` so a published issue still gets summary copy when the stored summary field is blank.
- Homepage and issue pages now prefer the saved editorial summary, then fall back to the derived summary.
- Verification passed: focused summary test, full Vitest suite, ESLint, and production build.
- Local pre-render still cannot show live issues because the local Supabase env values are blank; live verification must happen against the deployed Vercel environment.

# Task: Homepage Editorial Polish

- [x] Convert the latest issue area into an editorial feature block.
- [x] Add derived key developments beneath the issue hook.
- [x] Collapse previous issues behind a native archive drawer.
- [x] Generate/save stronger issue hooks during manual and scheduled publish.
- [x] Carry derived summaries into issue metadata, RSS, and JSON-LD fallbacks.
- [x] Verify focused summary tests, full test suite, lint, and production build.

## Review

- Latest issue now presents the date, an editorial hook, key developments, and a compact issue file instead of a flat ledger.
- Previous issues are collapsed by default with the full archive link still visible.
- Issue summary fallback now looks at titles plus article summaries to identify the main theme.
- Manual publish and scheduled publish now save an AI-generated issue hook when the issue has no saved summary, with the deterministic fallback as backup.
- Verification passed: `npm test -- tests/lib/issue-summary.test.ts`, `npm test`, `npm run lint`, and `npm run build`.

# Task: Admin Proportion Polish

- [x] Normalize the admin shell width, spacing, panel radius, and shadows.
- [x] Make the Daily Run header, step rail, and navigation controls feel proportionate.
- [x] Apply consistent heading, copy, panel, and button treatment across Status, Choose, Edit, Check, and Publish.
- [x] Verify desktop guided steps with browser screenshots.
- [x] Verify mobile admin has no page-wide horizontal overflow and keeps step labels readable.
- [x] Verify lint, admin readiness tests, and production build.

## Review

- Admin now uses a shared `admin-shell`, `admin-page-title`, `admin-eyebrow`, and `admin-copy` system.
- The six-step rail uses equal columns on desktop and a clean horizontal scroll on mobile.
- The main panels now use consistent padding, softer borders, and calmer shadows.
- Browser smoke checks passed for Status, Choose, Edit, Check, and Publish at desktop width, plus mobile Status.

# Task: Full Desk Admin Polish

- [x] Bring the Full Desk shell and tab rail onto the same admin visual system.
- [x] Normalize Issue Append and Live Issue Desk panels, labels, inputs, notices, and buttons.
- [x] Clean up supporting utility panels so the full-desk view feels proportionate.
- [x] Verify lint, tests, and production build.
- [x] Verify Full Desk desktop and mobile browser layout.
- [x] Commit, push, deploy, and verify live admin.

## Review

- Full Desk now shares the same title, eyebrow, copy, subpanel, input, notice, and button treatments as the guided flow.
- Issue Desk tabs keep readable labels on mobile by using a horizontal rail instead of wrapping.
- Issue Append, Live Issue Desk, published updates, capture settings, and stats utilities now have calmer borders and more consistent spacing.
- Verification passed: `npm run lint`, `npm test`, `npm run build`, plus desktop/mobile Full Desk browser smoke checks with no page-wide horizontal overflow.
- Deployed to production and verified live `/admin` at desktop and mobile widths.

# Task: Footer Proportion Polish

- [x] Give the shared footer stronger hierarchy and breathing room.
- [x] Separate brand, disclosure, companion project, and credit/social areas.
- [x] Keep the existing institutional editorial palette and links.
- [x] Verify lint, build, and desktop/mobile footer rendering.
- [x] Commit, push, deploy, and verify live footer.

## Review

- The footer now has clearer editorial hierarchy, larger brand treatment, and better spacing between disclosure, companion project, and credit/social rows.
- Desktop and mobile footer browser checks passed with no horizontal overflow.
- Verification passed: `npm run lint`, `npm test`, `npm run build`, and footer-specific desktop/mobile smoke checks.
- Deployed to production and verified the live footer on desktop and mobile.

# Task: Homepage Rule Cleanup

- [x] Remove doubled black section rules on the homepage.
- [x] Preserve the editorial section rhythm with single transition rules.
- [x] Verify lint, build, and desktop/mobile homepage rendering.
- [x] Commit, push, deploy, and verify live homepage.

## Review

- Homepage intro and latest issue sections now use single top rules instead of stacked top-and-bottom black rules.
- Verification passed: `npm run lint`, `npm test`, `npm run build`, and a local homepage render check confirmed the intro no longer has a bottom black rule.
- Live desktop/mobile checks confirm intro, latest issue, and archive each have a single top rule with no bottom black rule stacking.

# Task: Publish Acknowledgement Alignment

- [x] Align the warning acknowledgement checkbox and label in the publish readiness panel.
- [x] Verify lint/build and admin rendering.
- [x] Commit, push, deploy, and verify live admin.

## Review

- Warning acknowledgement now uses a two-column grid row with centered alignment and a fixed-size checkbox.
- Verification passed: `npm run lint`, `npm test`, `npm run build`, and a browser check confirmed the checkbox and label share the same centerline.
- Deployed to production and verified the live admin checkbox and label centers match.

# Task: Google Alerts AI Candidate Grab

- [x] Recover the current Google Alerts RSS feed URLs from the saved automation outputs.
- [x] Fetch the current feed entries and normalize them into AI Today candidate shape.
- [x] Filter for usable AI Today stories and save a reviewable local output.
- [x] Dry-run the existing candidate importer against the output.
- [x] Import the curated set into the live Candidate inbox.
- [x] Verify the live Candidate inbox has the imported Google Alerts items.

## Review

- Fetched 13 Google Alerts RSS feeds, with 260 raw entries and no feed failures.
- Saved the first-pass candidate output under `tmp/google-alerts-current/2026-05-12T02-22-34/`.
- Narrowed the first-pass set from 50 to 26 usable AI Today candidates by removing social posts, jobs, obvious non-AI items, and low-value duplicates.
- Dry-run verification passed against `scripts/import-candidates-from-automation-output.mjs`.
- Imported 26 candidates into the live AI Today Candidate inbox and verified `26` new `Google Alerts Current RSS` items through the production API.

# Task: May 11 Article Population Investigation

- [x] Map the live article intake paths for candidates, draft assembly, and publish.
- [x] Confirm the May 11, 2026 automation schedule in Winnipeg time.
- [x] Inspect local and production-backed data to see where May 11 content exists or failed.
- [x] Run safe May 11 dry-runs without mutating live data.
- [x] Fix the smallest code or configuration issue if the root cause is in the app.
- [x] Verify admin and public surfaces show accurate May 11 state.
- [x] Document the outcome, commands, and any remaining blocker.

## Review

- Current Vercel cron config runs daily assemble at 23:00 UTC, which is 6:00 PM Winnipeg time during May, and publish at 02:00 UTC, which is 9:00 PM Winnipeg time.
- Production May 11 issue existed and was published, but initially had only 3 articles, all under Industry & Models.
- Safe production dry-run for `2026-05-11` showed `Canada AI Daily` had 3 parsed items, `Agriculture AI` had a failed Google Alerts digest with 0 items, `Daily News - AI` had a failed Google Alerts digest plus fallback items that were already duplicates, and research had 0 papers.
- Separate Google Alerts RSS recovery imported 26 current candidates into the live Candidate inbox after the issue had already published.
- Backfilled the May 11 published issue with 4 clean, non-duplicate items: Bill C-16/deepfake amendments, Canadian AI regulation commentary, OpenAI/privacy coverage, and Microsoft SocialReasoning-Bench.
- Skipped the TELUS sovereign compute item because issue-memory correctly flagged it as related to a May 5 sovereign compute story, and skipped the Senate PDF because the fetcher would title it as `sencanada.ca`.
- Production verification now shows May 11 has 7 articles across Industry & Models, Policy & Regulation, Canada, and Research, with no duplicate, stale-source, missing-title, missing-summary, or broken-URL blockers.
- Code changes made locally: date-targeted daily assemble now writes to the requested issue date instead of implicit "today"; title extraction decodes numeric apostrophe entities; admin workflow copy now says evening and documents the 6 PM / 9 PM Winnipeg schedule.
- Created the active Codex automation `AI Today evening RSS candidate import` to repeat the Google Alerts RSS candidate import each evening before the publish window.
- Validation passed: focused article-fetcher test, full Vitest suite, ESLint, production build, and live API/page smoke checks.

# Task: Canada-First Article Intake Volume

- [x] Map all intake paths from source feeds to candidate review, draft assembly, and publish.
- [x] Measure recent raw feed, candidate, imported, draft, and published counts.
- [x] Identify why the review queue can look thin even when candidates exist.
- [x] Improve scoring and ordering so Canadian articles surface first.
- [x] Improve category inference for Canadian public-sector, policy, research, and sector stories.
- [x] Keep noise, duplicates, stale links, and weak URL-title items filtered.
- [x] Add focused tests for scoring, Canada-first ordering, and category inference.
- [x] Validate with tests, build, safe dry-runs, and read-only production checks.
- [x] Document counts, changed files, commands, and remaining risks.

## Review

- Mapped the real paths: Google Alerts RSS files import into the Candidate inbox through `scripts/import-candidates-from-automation-output.mjs` and `/api/article-candidates`; briefing pages and AI Voices fallback feed draft assembly through `/api/import-briefing-articles` and `/api/cron/daily-assemble`; research papers and manual/admin adds are separate paths; publish reads the draft/published issue storage.
- Recent Google Alerts evidence shows the source volume is not the main bottleneck: the current RSS grab had 13 feeds, 260 raw entries, 50 first-pass candidates, and 26 curated importable candidates. The May 9 repair grab had 13 feeds, 255 raw entries, and 35 included candidates. Agriculture had 6 feeds, 24 raw entries, and 12 included candidates.
- Production read-only status for May 11 showed 23 active candidates, 44 rejected, 6 imported, and a published issue with 7 articles after the earlier backfill. The safe May 11 assemble dry-run parsed 13 items but imported only 1 because most draft candidates were already duplicates and one agriculture digest was a failed Google Alerts digest.
- Root cause: the candidate inbox had enough raw material, but imported automation scores were on a small scale like 14/12/11 while the app treated them as 0-100 scores. That made "top picks" look empty, pushed Canadian items down, and left the admin feeling sparse even when the inbox had usable stories.
- Updated candidate normalization so low-scale automation scores are normalized, strong app-computed scores can override weak upstream scores, and Canadian relevance gets a stronger ranking signal.
- Added Canada-first category inference and sorting. Canadian items now stay in `Canada` even when a source labels them as generic policy, and admin candidate views sort Canada-relevant stories before higher-scored global items.
- Added a Research category mapping rule so research/paper/benchmark source sections no longer fall into generic Industry & Models.
- Updated the candidate inbox and candidate triage UI sorting to use the same Canada-first comparator as the store layer.
- Noise filtering remains intact: existing dedupe, stale-source, weak-title, weak-source, duplicate-topic, and canonical URL handling were not loosened.
- Validation passed: `npm run test -- tests/lib/article-candidates.test.ts tests/lib/category-mapping.test.ts`, `npm test`, `npm run lint`, and `npm run build`.
- Remaining risk: production will not use the improved scoring/order/category logic until this branch is deployed. No push, deploy, live publish, destructive data edit, or secret change was performed for this task.

# Task: Canada-First Public Issue Section Order

- [x] Confirm why May 11 rendered Industry & Models before Canada.
- [x] Apply the canonical category order to public issue section rendering.
- [x] Keep the table of contents in the same Canada-first order.
- [x] Add a regression test for out-of-order saved blocks.
- [x] Verify focused tests, full test suite, lint, and production build.

## Review

- Root cause: the stored May 11 issue blocks were saved with `Industry & Models` before `Canada`, and the public renderer preserved stored block order even though the taxonomy order already had `Canada` first.
- Added a shared `categoryOrderRank` helper and used it to order public issue sections by the canonical taxonomy, with `Canada` first, without rewriting stored issue data.
- Updated the issue table of contents to use the same ordering so desktop/mobile navigation matches the rendered article body.
- Added a renderer regression test proving `Canada` renders first even when saved after `Industry & Models`.
- Verification passed: `npm run test -- tests/lib/notion-renderer.test.tsx tests/lib/category-mapping.test.ts`, `npm test`, `npm run lint`, and `npm run build`.

# Task: Canadian Article Routing

- [x] Add one shared Canada-detection rule for article title, summary, annotation, source, and URL.
- [x] Apply the rule to candidate scoring/category inference.
- [x] Apply the rule to scheduled daily assemble and manual briefing import.
- [x] Apply the rule at final issue append so live/manual additions cannot land in the wrong section.
- [x] Make the admin briefing import buckets reflect the same Canada-first routing.
- [x] Add tests for Canada mentions, Canadian domains, and place-name routing.
- [x] Verify focused tests, full tests, lint, and production build.

## Review

- Added `isCanadaMention` and `categoryForArticle` in `lib/category-mapping.ts`.
- Any article mentioning Canada, Canadian, common Canadian places, known Canadian news/source names, Canadian government domains, or `.ca` source domains is now routed to `Canada` even when the upstream source labels it as Policy, Industry, Research, or another section.
- The rule now runs in the candidate layer, admin briefing import view, `/api/import-briefing-articles`, `/api/cron/daily-assemble`, `/api/append-to-issue`, and the final `appendArticleToIssue` storage function.
- Verification passed: `npm run test -- tests/lib/category-mapping.test.ts tests/lib/article-candidates.test.ts tests/lib/notion-renderer.test.tsx`, `npm test`, `npm run lint`, and `npm run build`.

# Task: Compact Issue Footer

- [x] Reduce the issue tools area height.
- [x] Make previous/next issue navigation compact.
- [x] Replace large related-issue cards with compact archive rows.
- [x] Verify lint, full tests, and production build.

## Review

- The lower issue footer now behaves like a compact utility/archive strip instead of a large second page section.
- Previous/next links use smaller type and tighter spacing.
- Related archive links now render as compact rows with issue number, date, and a shortened summary.
- Verification passed: `npm run lint`, `npm run build`, and `npm test`. The first build attempt hit a local Windows/OneDrive `.next` file lock; clearing the local build cache and rerunning passed.
