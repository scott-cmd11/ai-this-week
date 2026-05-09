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
