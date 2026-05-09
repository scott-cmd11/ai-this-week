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
