# Task: Strict AI Good News Relevance Gate

- [x] Audit the live `/positive-ai` story set and identify weak or negative stories.
- [x] Tighten deterministic scoring with a high-relevance good-news gate.
- [x] Disable broad or noisy feeds that were filling the page with weak stories.
- [x] Apply the strict gate to stored published stories, live supplements, and digest generation.
- [x] Add regression tests for negative/mixed framing, regulation/compliance stories, generic AI research, and strong public-good stories.
- [x] Update empty-state copy to prefer no story over weak filler.
- [x] Complete local production build and smoke checks in a clean positive-AI validation worktree.

## Strict AI Good News Audit

- Bad live examples removed by the new gate:
  - `Musk 'wanted 90%' of OpenAI, Altman tells feisty tech titan trial` - legal dispute / trial framing, not good news.
  - `Navigating EU AI Act requirements for LLM fine-tuning on Amazon SageMaker AI` - compliance/vendor how-to, not human-benefit news.
  - `How Amazon Finance streamlines regulatory inquiries by using generative AI on AWS` - internal finance/regulatory workflow, weak public benefit.
  - `Automate schema generation for intelligent document processing` - generic vendor workflow, no clear human-benefit outcome.
  - `Design tweaks promote responsible AI use for environmental protection` - mainly about AI energy-consumption harm and reducing AI use.
  - `Is your AI chatbot manipulating you?` - manipulation/risk framing.
  - `AI doesn't create bias, it inherits it` - bias/risk framing.
  - `Touch dreaming helps humanoid robots...` - speculative robotics research without a clear human-benefit outcome.
- Source changes: disabled `Tech Xplore AI`, `AWS Machine Learning Blog`, and blocked `NOAA Research` feed. The remaining feeds are more likely to produce primary, institutional, health, accessibility, education, science, public-good, or Canadian innovation stories.
- New public rule: a story must have an AI relevance signal, a human-benefit domain, a positive impact signal, enough credibility/evidence, and no hard-excluded framing. Public pages re-score stored stories too, so already-published weak stories stop surfacing.

## Strict AI Good News Validation

- `node scripts/ingest-ai-good-news.mjs --dry-run` passed: 16 enabled sources, 4 raw last-24-hour candidates, 0 source errors.
- `npm run test -- tests/lib/good-news-scoring.test.ts tests/lib/good-news-dedupe.test.ts tests/lib/good-news-digest.test.ts` passed after tightening fixture expectations: 3 files, 11 tests.
- `npm run lint` passed.
- `npx tsc --noEmit` passed.
- `npm run build` in the main checkout is currently blocked by unrelated local publishing-preflight work (`lib/publishing-preflight.ts`) that is outside the positive-AI change. Build/smoke will be validated from a clean worktree containing only this fix.
- `npm install` and `npm run build` passed in clean validation worktree `C:\Users\scott\AppData\Local\Temp\ai-this-week-positive-gate-d1b18a1` at commit `d1b18a1`.
- Local production smoke on `http://localhost:3046` passed for `/positive-ai`, `/positive-ai/archive`, `/positive-ai/about`, and `/positive-ai/stories/seed-mattersim-materials-ai`; `/positive-ai/stories/seed-alphafold-3-server` correctly returned `404`.
- Story-surface content check passed: the homepage, archive, and story detail showed 1 qualifying story and did not surface the rejected live examples, old AlphaFold seed story, or blocked themes.

# Task: May 13 Missed Publish Incident

- [x] Verify the live May 13 issue state before changing anything.
- [x] Inspect admin status, candidate freshness, GitHub source workflow runs, and dry-run assemble/publish checks.
- [x] Patch the evening Google Alerts workflow so delayed GitHub scheduled runners do not skip the intended 7 PM Winnipeg import.
- [x] Extend the publishing preflight script so it catches "assemble has source material, but no draft exists."
- [ ] Push the workflow/preflight fix to GitHub.
- [ ] Decide whether to mutate live data to backfill the May 13 issue.

## May 13 Incident Evidence

- `https://aitoday.vercel.app/issues/2026-05-13` returned 404.
- Live `/api/admin/today-status?date=2026-05-13` returned no draft, not published, 0 articles, `preflight = blocked`, and `eveningBriefing = stale`.
- The live candidate pool still showed 13 active candidates and 5 top picks, but the newest candidate activity was `2026-05-12T02:29:43Z`, which is May 11 in America/Winnipeg time.
- GitHub Actions showed the `Evening Google Alerts Candidate Import` workflow active on `main`, but both May 13 scheduled runs logged success while skipping import because the runner actually started around 11 PM Winnipeg. The old gate checked runner wall-clock hour instead of the intended scheduled UTC slot.
- A read-only dry run of `/api/cron/daily-assemble` for `2026-05-13` found 17 parsed source items and 7 importable articles. So there was source material; the draft was not written.
- A read-only dry run of `/api/cron/daily-publish` for `2026-05-13` returned `no_draft`, matching the missing issue.
- Vercel cron config still lists `/api/cron/daily-assemble` at `0 23 * * *` and `/api/cron/daily-publish` at `0 2 * * *`, but Vercel logs did not show matching daily assemble/publish entries for the incident window.

## May 13 Prevention Fix

- Updated `.github/workflows/evening-google-alerts-candidates.yml` so schedule gating uses the intended scheduled cron slot mapped into America/Winnipeg time. If GitHub starts the runner late, the correct 7 PM slot still imports.
- Kept the two UTC cron slots for DST coverage: `15 0 * * *` maps to 7:15 PM Winnipeg during daylight time, and `15 1 * * *` maps to 7:15 PM during standard time.
- Updated `scripts/publishing-preflight.mjs` to call daily assemble in read-only dry-run mode. It now fails the preflight when assemble has importable source material but no draft exists, which is exactly the May 13 failure shape.
- Validation: `node --check scripts/publishing-preflight.mjs`, `git diff --check`, and `npm run preflight:publishing -- --api-base https://aitoday.vercel.app --date 2026-05-13 --warn-only` passed as executable checks. The preflight now explicitly reports: `Daily assemble has material but no draft exists.`

# Task: Publishing Prevention Guardrails

- [x] Audit how recent publishing failures became possible before code changes.
- [x] Confirm whether the evening Google Alerts workflow is active on the default GitHub branch.
- [x] Add a durable daily publishing preflight model for source jobs, candidate freshness, volume, draft state, and next editor action.
- [x] Add a read-only operator check for default-branch workflow drift and publishing health.
- [x] Keep admin-facing prevention language visible without making the daily flow more technical.
- [x] Add regression tests for stale/low-volume readiness, source-health summary, publish blocking, and post-publish repair guidance.
- [x] Add the 8 PM Winnipeg operator runbook and deploy verification checklist.
- [x] Run validation and document results, live-data actions avoided, residual risks, and the next evening handoff.

## Prevention Audit

- The evening Google Alerts candidate workflow exists locally on this branch as `.github/workflows/evening-google-alerts-candidates.yml`, but read-only GitHub/default-branch checks showed `origin/main` only has `.github/workflows/daily-briefing.yml`.
- `gh workflow list --repo scott-cmd11/ai-this-week --all` showed only `Daily AI Briefing` as active. The evening Google Alerts workflow is therefore branch-side/local code, not an active scheduled workflow on the default branch.
- Scheduled GitHub Actions only run from the repository default branch. A direct Vercel deployment from a feature branch can make app code live, but it does not activate a missing GitHub scheduled workflow on `main`.
- Candidate volume became stale/too small because the admin inferred source health from candidate rows after the fact. The desk could show candidates, but it did not clearly gate publishing on "did tonight's source run actually happen in America/Winnipeg time?"
- May 12 stayed live with 2 articles while active candidates remained available because the published issue needed a post-publish repair path and a stronger operator signal. The current guardrail blocks future thin publishes, but the live repair state still needs to stay impossible to miss.
- Source health was inferred late from candidate counts instead of treated as a preflight operating gate. A normal editor should see source freshness, candidate totals, strong candidates, draft count, and the next safe action before reaching publish.
- The admin flow had improved into a single desk, but "is the whole pipeline healthy enough to publish?" still needs a plain-language preflight result that can be used before publishing and after deployment.
- Production deploy verification previously checked page/admin availability, but it did not include default-branch GitHub workflow presence, active scheduled workflow state, cron schedule clarity, source freshness, candidate-volume gates, and dry-run publish safety in one repeatable checklist.
- Existing unrelated Positive AI files are dirty in the working tree and must be left untouched: `config/ai-good-news-sources.json`, `lib/good-news-current.ts`, `lib/good-news-scoring.ts`, and `tasks/screenshots/ai-good-news-multi-story-desktop.png`.

## Prevention Implementation Plan

- [x] Add a shared publishing preflight helper that turns existing admin status, evening briefing, and optional workflow checks into a clear state: ready, hold, repair, or blocked.
- [x] Add a workflow guard that warns/fails when required scheduled workflow files exist locally but are missing or inactive on the default GitHub branch.
- [x] Add a read-only `npm run preflight:publishing` operator script that checks admin status, candidate health, Vercel cron shape, and GitHub default-branch workflow state without mutating data.
- [x] Add a dry-run/read-only cron publish evaluation path so deploy checks can verify publish gates without publishing.
- [x] Surface the preflight/runbook language in the admin Health tools area so editors know the daily check exists.
- [x] Add focused tests for workflow drift, stale evening readiness, low-volume hold states, published repair guidance, and dry-run cron refusal.
- [x] Add a concise 8 PM Winnipeg publishing runbook and deploy verification checklist.

## Prevention Review

- Added `lib/publishing-preflight.ts` as a shared prevention model. It turns source freshness, candidate volume, draft/publish readiness, published repair state, imported candidate traceability, and optional workflow checks into one state: `ready`, `hold`, `repair`, or `blocked`.
- `/api/admin/today-status` now returns `preflight` alongside `eveningBriefing`, `readiness`, candidates, automation, and draft status. This keeps the daily desk focused on the editor question: can I publish, should I hold, or do I need repair work?
- The admin `Today's Run Status` now shows a visible Preflight card and a plain-language blocked/hold/repair note when publishing should not quietly continue.
- Added a read-only dry-run path to `/api/cron/daily-publish`: `POST` with `dryRun: true` and the admin password evaluates cron publish readiness without publishing. Normal cron `GET` behaviour remains protected by `CRON_SECRET`.
- Added `scripts/publishing-preflight.mjs` and `npm run preflight:publishing`. It checks the admin status shape, candidate API, dry-run cron publish, `vercel.json` cron entries, and required scheduled workflows on the GitHub default branch.
- The preflight script correctly flags the known current gap: `.github/workflows/evening-google-alerts-candidates.yml` exists locally but is missing from default branch `main`, so GitHub will not schedule the evening Google Alerts source run.
- Added `docs/publishing-runbook.md` with the normal 8 PM Winnipeg publishing routine, low-volume recovery path, Issue Desk repair guidance, deploy verification checklist, and do-not-publish conditions.
- Updated `tasks/lessons.md` with the durable rule: scheduled publishing automation must be verified on the default branch, not trusted because it exists locally or was deployed from a feature branch.

## Prevention Validation Results

- `npm run test -- tests/lib/publishing-preflight.test.ts` passed: 1 file, 5 tests.
- `npm run test -- tests/api/publishing-pipeline.test.ts` passed: 1 file, 6 tests.
- `npm run test -- tests/lib/admin-readiness.test.ts tests/lib/article-candidates.test.ts tests/api/publishing-pipeline.test.ts tests/lib/publishing-preflight.test.ts` passed: 4 files, 28 tests.
- `npm test` passed: 20 files, 93 tests.
- `npm run lint` passed before and after the final script polish.
- `npm run build` initially caught a TypeScript narrowing issue in the new workflow guard, then passed after the fix.
- `npx tsc --noEmit` passed after the build.
- `node --check scripts/publishing-preflight.mjs` passed.
- Local browser smoke on `http://localhost:3044/admin` passed at 1280x900 desktop and 390x844 mobile after signing in locally. It verified the Publishing Desk, Preflight card, `Tonight's Issue`, `Issue Desk`, and `Tools`.
- Screenshots saved:
  - `tasks/screenshots/publishing-prevention-admin-desktop.png`
  - `tasks/screenshots/publishing-prevention-admin-mobile.png`
- Local read-only API smoke:
  - `/api/admin/today-status?date=2026-05-13` returned 200 with `preflight = blocked` and `eveningBriefing = source_error` because the local environment has no candidate inbox configured.
  - `/api/article-candidates?status=new,approved,shortlisted&limit=5` returned 200 with 0 local candidates.
  - `/api/cron/daily-publish` dry-run POST returned 200 with `reason = no_draft` and `dryRun = true`; it did not publish.
  - Local `/issues/2026-05-12` returned 404 because the local static build does not contain the live production issue.
  - Live read-only `https://aitoday.vercel.app/issues/2026-05-12` returned 200.
- `npm run preflight:publishing -- --api-base http://localhost:3044 --date 2026-05-13 --warn-only` passed as an executable check and reported attention needed: local source intake blocked, candidate API reachable, dry-run publish reachable, Vercel crons present, and the evening Google Alerts workflow missing from `main`.
- No live production data was mutated. No Supabase schema changes, secrets, push, deploy, destructive live actions, or production write-path tests were performed.

## Residual Risks And Next Evening Checklist

- This branch still needs to be pushed and deployed later before production `/api/admin/today-status` and `/api/cron/daily-publish` expose the new preflight/dry-run behaviour.
- The evening Google Alerts workflow must be present and active on `main`; otherwise the 7:15 PM Winnipeg source run will remain branch-only and will not run on schedule.
- Source run history is still inferred from candidate rows. The new guardrails make stale/low-volume states visible, but a future source-run registry would make per-source success/failure history more authoritative.
- Normal daily routine: around 8:00 PM Winnipeg, run `npm run preflight:publishing -- --api-base https://aitoday.vercel.app --strict`, then open `/admin`, confirm the preflight and evening briefing are understandable, review/import candidates, edit the draft, and publish only through the checklist.
- If volume is low: do not publish by default. Check the preflight output, confirm default-branch workflow health, retry source intake in Tools, refresh the desk, and use Issue Desk for already-published repairs.
- Do not use the intentional short-issue override unless the source pipeline is understood and the short issue is a deliberate editorial decision.

# Task: Publishing Desk Overhaul

- [x] Audit the current admin UX, source intake, candidate counts, cron timing, issue edit paths, and publish gates before code changes.
- [x] Document why the current workflow feels too complex and why the May 12 candidate pool looked too small.
- [x] Add an 8 PM evening briefing/readiness model with candidate volume and source-health diagnostics.
- [x] Replace the guided/full split with one primary "Tonight's Issue" desk and a top-level Issue Desk.
- [x] Keep candidate review, draft editing, preview/readiness, and publish checks in one coherent daily flow.
- [x] Make published-issue add/edit/remove/correction controls first-class.
- [x] Add/update tests for candidate volume status, daily readiness, publish gates, and issue editing visibility.
- [x] Run focused tests, full tests, lint, build, TypeScript if needed, and local browser smoke checks.
- [x] Document final results, live-data actions avoided, residual risks, and next-run operator handoff.

## Publishing Desk Audit

- Product root cause: the admin currently asks an editor to understand a six-step rail (`Status`, `Intake`, `Choose`, `Edit`, `Check`, `Publish`) plus a separate `Full desk` mode. That splits one mental task, "make tonight's issue good enough and publish it," into several technical surfaces.
- Candidate review, draft review, publish readiness, and live issue repair are real capabilities, but they are distributed across separate panels. The editor has to remember where a thing lives rather than being led through a single issue desk.
- Issue editing after publication exists and is useful, but it is buried under `Full desk > Issue Desk`. That makes add/edit/remove/correction work feel like a workaround even though it is a normal publishing need.
- The admin status panel reports `Automations` using placeholder-like data: `lastRunAt: null`, `sourceCount: 0`, and only candidate-store errors as failures. It does not tell the editor whether the evening source run actually happened.
- Live read-only May 12 evidence showed the issue was already published with 2 articles while 13 active candidates and 5 top picks still existed. The active candidates were all from `Google Alerts Current RSS`.
- The 13 active candidates were not a full daily supply; they were the leftover active slice after earlier import/reject decisions. The broader visible pool included imported and rejected candidates, but the admin did not present source totals, rejected counts, imported counts, or stale-run context together.
- The latest active candidate timestamp was from the previous evening run, not a fresh May 12 evening run. That made the pool look like "today's supply" when it was really an old candidate state.
- The intended Google Alerts candidate workflow exists in this branch, but read-only GitHub checks found it is not active on the repository default branch. Scheduled GitHub workflows only run from the default branch, so the 7:15 PM candidate import is not currently a dependable cloud job until the workflow is on `main`.
- Vercel cron runs daily assemble around 6:00 PM Winnipeg and daily publish around 9:00 PM Winnipeg. The assemble job writes draft material from configured briefing sources; it is not the same thing as filling the candidate inbox from Google Alerts/RSS.
- Current source-health data is not persisted. The app can infer candidate freshness and source mix from the candidate store, but it cannot yet report a durable "last source job succeeded/failed" record without adding a registry or storage layer.
- The thin-issue guardrail now blocks low-count normal publishing, but the user-facing path still feels like blocker management rather than a calm checklist: add selected candidates, retry sources, append to published issue, or intentionally short-publish.

## Publishing Desk Implementation Plan

- [x] Extend admin readiness with an `eveningBriefing` summary: 8 PM target, candidate target, publish-ready target, latest candidate timestamp, total visible candidate pool, source mix, stale-run state, low-volume reasons, and next editor action.
- [x] Keep the first implementation schema-free by deriving source health from existing candidate rows and known imported issue context.
- [x] Update `/api/admin/today-status` to return the richer summary without changing auth, URLs, Supabase schema, or public rendering.
- [x] Rework the admin shell into three obvious modes: `Tonight's Issue`, `Issue Desk`, and `Tools`.
- [x] Make `Tonight's Issue` show the readiness banner, source health, candidate triage, draft editor, and publish checks together so normal publishing happens on one scrollable desk.
- [x] Put the existing live issue editor and append controls directly under top-level `Issue Desk`.
- [x] Keep fallback/import/capture/settings utilities under `Tools` so they are available without being mistaken for the normal path.
- [x] Add friendly low-volume copy and clear actions: refresh status, review candidates, edit draft, retry/check source tools, publish checks, or open Issue Desk for already-published repair.
- [x] Add focused tests for the derived evening briefing state, stale/low candidate volume, and published low-count repair guidance.
- [x] Smoke check `/admin` at desktop and mobile widths without mutating live production data.

## Publishing Desk Review

- Added a schema-free evening briefing/readiness model in `lib/admin-readiness.ts` and `lib/admin-issue-readiness.ts`. It now reports the 8:00 PM America/Winnipeg target, candidate target, strong-candidate target, publish article target, total visible candidate pool, source mix, latest candidate timestamp, stale-run state, low-volume reasons, and next editor action.
- `/api/admin/today-status` now returns `eveningBriefing` alongside the existing readiness payload. Existing URLs, auth boundaries, Supabase schema, public rendering, RSS/feed, sitemap, metadata, Vercel config, and lockfiles were preserved.
- Replaced the old guided/full split with three editor-facing admin areas: `Tonight's Issue`, `Issue Desk`, and `Tools`.
- `Tonight's Issue` now keeps the daily work on one desk: briefing status, source health, candidate triage, draft editor, and publish checks are visible in one scrollable flow.
- `Issue Desk` is now top-level and contains the existing add/edit/remove published issue controls, so post-publish fixes are treated as normal editorial work instead of a secondary workaround.
- `Tools` now holds source/import fallback, future queue notes, health notes, and capture settings. The source tools are still available, but they no longer look like the default publishing path.
- Mobile polish: removed the old forced 42rem admin step rail width and wrapped candidate filter controls so the primary desk navigation and candidate views are readable on narrow screens.
- Added tests for stale evening intake, healthy evening readiness, and low-count published repair guidance. Updated publishing-pipeline test mocks for the richer readiness payload.

## Publishing Desk Validation Results

- `npm run test -- tests/lib/admin-readiness.test.ts tests/lib/article-candidates.test.ts tests/api/publishing-pipeline.test.ts` passed: 3 files, 22 tests.
- `npm test` passed: 19 files, 83 tests.
- `npm run lint` passed.
- `npm run build` first hit a local Windows/OneDrive `.next` file lock (`EPERM unlink`). After verifying and clearing only the workspace `.next` build cache, `npm run build` passed.
- `npx tsc --noEmit` passed.
- Local browser smoke on `http://localhost:3043/admin` passed at desktop and mobile widths using local Chrome. It verified `Tonight's Issue`, `Issue Desk`, and `Tools`, with no write actions.
- Screenshots saved:
  - `tasks/screenshots/publishing-desk-desktop.png`
  - `tasks/screenshots/publishing-desk-mobile.png`
- Local read-only API/page smoke:
  - `/admin` returned 200.
  - `/api/admin/today-status?date=2026-05-12` returned 200 with local `eveningBriefing.state = source_error` because this local environment does not have the article candidate inbox configured.
  - `/api/article-candidates?status=new,approved,shortlisted&limit=25` returned 200 with 0 local candidates for the same reason.
  - `/issues/2026-05-12` returned 200 locally.
- Live read-only checks avoided all writes and confirmed production still has the old May 12 state until this branch is deployed:
  - `https://aitoday.vercel.app/api/admin/today-status?date=2026-05-12` returned 200 with `published = true`, `articleCount = 2`, `activeCandidates = 13`, and `topPicks = 5`.
  - `https://aitoday.vercel.app/api/article-candidates?status=new,approved,shortlisted&limit=25` returned 200 with 13 candidates.
  - `https://aitoday.vercel.app/issues/2026-05-12` returned 200.
- No live production data was mutated. No secrets, Supabase schema, production config, lockfiles, push, deploy, or destructive production actions were changed.

## Residual Risks And Operator Handoff

- Source health is currently inferred from candidate rows. That is enough to make stale/low-volume states visible, but it is not a durable source-run registry. A later small migration or log table would make per-source failure history more authoritative.
- The evening Google Alerts GitHub Actions workflow exists in this branch but read-only GitHub checks showed it is not active on the repository default branch. Scheduled GitHub workflows will not run reliably until that workflow is on `main`.
- The next safe operational move is to deploy this admin desk, make sure the evening Google Alerts workflow is present on `main`, then open `/admin` around 8:00 PM Winnipeg. The desk should show whether the briefing is ready, stale, low-volume, or source-error before any publish decision.
- For a normal daily run: use `Tonight's Issue`, review candidates, keep enough strong items to reach an 8-article target when possible, edit the draft, then run the publish checklist.
- If candidate volume is low: use `Tools` to check source/import fallback first; do not use the intentional short-issue override unless it is an explicit editorial decision.
- For the already-published May 12 issue: after this branch is deployed, use top-level `Issue Desk` to append the strongest remaining candidates, edit/remove anything needed, then verify the public issue page.

# Task: AI Good News Daily Story Volume Fix

- [x] Verify production was only showing one public AI Good News story.
- [x] Trace the cause through the positive AI store, RSS source list, ingestion status, and digest logic.
- [x] Broaden the editable RSS source list with additional current AI/science/education feeds.
- [x] Add a current-story supplement path so public pages do not collapse to a single seed story when the Good News table is empty or unavailable.
- [x] Keep public pages restricted to published, positive-scored, last-24-hour stories.
- [x] Make the scheduled digest ingestion publish accepted high-confidence stories instead of leaving everything pending.
- [x] Regenerate the homepage digest when the current story set is larger than the saved digest.
- [x] Validate lint, TypeScript, focused tests, build, local smoke, negative-term scan, and screenshot.

## AI Good News Daily Story Volume Review

- Root cause: `/positive-ai` only had one current published fallback story, the configured RSS list was too narrow, and accepted RSS ingestion saved stories as `pending` while the public page only renders `published`.
- Added `lib/good-news-current.ts` to merge stored published stories with a short-lived live RSS supplement when fewer than the target daily count is available.
- Expanded `config/ai-good-news-sources.json` from 4 to 10 RSS feeds, including MIT News AI, Tech Xplore AI, ScienceDaily AI, Google AI Blog, Google Research Blog, and AWS Machine Learning Blog.
- Tightened negative exclusions for manipulation, nuclear/bomb, hate-speech, and criminal-justice framing, while adding grounded benefit/evidence signals for detection, earlier intervention, reduced harm, longer life, laboratories, universities, and research teams.
- Updated `/positive-ai`, `/positive-ai/archive`, story detail, and sitemap to use the current published story helper.
- Local production smoke showed 6 last-24-hour public stories and no AlphaFold or excluded negative terms.
- Screenshot saved at `tasks/screenshots/ai-good-news-multi-story-desktop.png`.

## AI Good News Daily Story Volume Validation

- `node scripts/ingest-ai-good-news.mjs --dry-run` checked 10 sources and found 18 current raw candidates; NOAA Research still returned HTTP 403.
- `npm run lint` passed.
- `npm run test -- tests/lib/good-news-scoring.test.ts tests/lib/good-news-dedupe.test.ts tests/lib/good-news-digest.test.ts` passed.
- `npx tsc --noEmit` passed.
- `npm run build` passed after clearing a stale locked `.next` build artifact.
- Local production smoke on `http://localhost:3041/positive-ai` confirmed the digest says `A concise scan of 6 positive, source-linked AI stories` and old AlphaFold content is absent.

# Task: Prevent Thin Daily Issue Publishing

- [x] Read AGENTS.md, task notes, package/build config, cron config, admin status/readiness, candidate store, candidate APIs, import, publish, append, issue-date, issue-store, and tests.
- [x] Gather read-only live evidence for the May 12, 2026 issue and candidate inbox.
- [x] Write root-cause evidence and implementation plan before code changes.
- [x] Make low article count a normal publish blocker with an explicit editor override path.
- [x] Keep cron publish conservative: no short-issue override for scheduled publishing.
- [x] Prevent candidate imports from being marked imported unless a write actually lands in the intended issue.
- [x] Expose imported issue/date context for imported candidates without requiring a schema change.
- [x] Make admin readiness clearly call out low-count published issues and active candidates still waiting.
- [x] Add focused regression tests and run the release validation.

## Root Cause Evidence

- Live read-only status for `/api/admin/today-status?date=2026-05-12` reported the May 12 issue as `published: true` with `articleCount: 2`, one section (`Canada`), no blockers, and warnings `missing_image` plus `low_article_count`.
- Live read-only issue item lookup confirmed the production issue `1e1e7ebe-0928-4fc0-8f0f-7fc58bd0f96f` / Issue 12 / `2026-05-12` has exactly two stored article items:
  - `Government of Canada supports 44 Canadian companies using AI to transform industries and create jobs`
  - `Vendasta expands AI workforce product via European-scale rollout`
- The live candidate inbox still had 13 active candidates and 5 top picks while the May 12 issue was already published. That means the publishing gate did not block a thin issue even though more candidate material was available.
- The publish readiness model currently treats `low_article_count` as a warning, not a blocker. The manual publish API allows publishing with warnings when the current checks fingerprint is acknowledged.
- Vercel production logs showed a successful `POST /api/publish-issue` shortly before the live checks, so the May 12 issue was published through the manual admin path rather than proven to be a cron publish.
- Candidate status only stores `imported_at`; it does not store an issue id, issue date, or issue number. The admin can say "imported" without showing where the article actually landed.
- Cross-checking imported candidate titles against live issue items showed several imported candidates are in the May 11 issue, not May 12. The `imported_at` timestamp alone is therefore not a reliable source of truth for the target issue/date.
- The code uses `issueDateFor()` in `America/Winnipeg`. A timestamp such as `2026-05-12T02:44Z` is still May 11 in Winnipeg, so late-evening import work can legitimately land in the prior local issue. The admin needs to show that target issue context, not just "imported."
- `/api/import-briefing-articles` writes to `captureArticleToTodaysDraft()` and returns per-article success/failure, but per-result payloads do not include the issue/date written. The client then separately patches candidate status to `imported`.
- If today's issue is already published, `captureArticleToTodaysDraft()` throws, but the route still returns HTTP 200 with per-item errors. That protects data, but the UI message can still be too weak and the workflow does not direct the editor to the live issue append path.

## Implementation Plan

- [x] Add a shared minimum daily article threshold and short-issue override policy.
- [x] Move `low_article_count` from warning to blocker for unpublished drafts below the minimum. Keep it as a warning for already-published issues so repair visibility remains.
- [x] Require a deliberate short-issue override in manual publish: exact confirmation text plus current checks fingerprint. Do not allow the override to bypass any other blockers.
- [x] Update Publish Checks UI so a short issue has a separate visible confirmation flow and cannot be published by the generic warning acknowledgement.
- [x] Keep cron publish blocking on low article count and return a clear `low_article_count` skip reason.
- [x] Add issue/date/number to successful import result payloads.
- [x] Add issue/date context to imported candidate API responses by matching candidate canonical URLs against recent issue blocks.
- [x] Update candidate inbox/triage UI to show imported issue context and only patch status after a successful import with issue context.
- [x] Improve import API errors when today's issue is already published, pointing editors to the live issue append workflow.
- [x] Add tests for low-count blocker/override policy, cron refusal, and imported candidate issue context.

## Thin Publish Fix Review

- Added `lib/publish-policy.ts` with the shared minimum count of 5 articles and the exact override phrase `PUBLISH SHORT ISSUE`.
- Admin readiness now treats a low-count unpublished draft as a blocker, keeps low-count published issues visible as warnings, and shows active candidates after publish plus imported candidates that cannot be matched back to an issue.
- Manual publish now fails closed on short issues unless the editor sends the current checks fingerprint and exact short-issue confirmation. The override cannot bypass other blockers.
- Cron publish has no override path and returns a clear skipped response with reason `low_article_count`, current count, minimum count, blockers, and warnings.
- Candidate import now refuses to import into an already-published target issue and points editors toward the live issue append workflow.
- Successful import responses now include the issue id, issue number, issue date, and article count written. Candidate inbox and triage only mark a candidate `imported` after that successful write context exists.
- Imported candidate API responses now expose inferred issue/date context by matching canonical URLs against recent published/draft issue items, which makes "imported where?" answerable without a database migration.
- Added regression coverage for publish policy, admin readiness, cron publish refusal, manual short-issue blocking/override, published-issue import rejection, and imported-candidate issue matching.
- Browser smoke screenshot saved at `tasks/screenshots/thin-publish-override-ui.png`.

## Thin Publish Validation Results

- `npm run test -- tests/lib/admin-readiness.test.ts tests/lib/publish-policy.test.ts tests/api/publishing-pipeline.test.ts` passed: 3 files, 15 tests.
- `npm run test -- tests/api/publishing-pipeline.test.ts` passed: 1 file, 5 tests.
- `npm run test -- tests/lib/admin-readiness.test.ts tests/lib/issue-summary.test.ts tests/lib/article-candidates.test.ts tests/lib/publish-policy.test.ts tests/api/publishing-pipeline.test.ts` passed: 5 files, 27 tests.
- `npm test` passed: 19 files, 78 tests.
- `npm run lint` passed.
- `npm run build` passed after clearing a stale locked `.next` build artifact inside this workspace.
- `npx tsc --noEmit` passed after the production build.
- Local read-only smoke on `http://localhost:3042/admin` passed.
- Local read-only API smoke on `http://localhost:3042/api/admin/today-status?date=2026-05-12` and `http://localhost:3042/api/article-candidates` passed against the local environment, which currently has no May 12 local draft/candidate data.
- Live read-only smoke on `https://aitoday.vercel.app/issues/2026-05-12` returned 200. Live read-only admin status still shows the production May 12 issue as published with 2 articles, 13 active candidates, and warnings `missing_image,low_article_count`.
- Local production `/issues/2026-05-12` returned 404 because the local build did not have that live issue in its generated static params; the live page check was used for that route.
- No live data was mutated, no secrets were changed, and nothing was pushed or deployed.
- Residual risk: imported issue/date context is inferred from canonical URL matches because preserving the Supabase schema was requested. If a source URL is missing or reused, a future schema field would be more authoritative.
- Follow-up recommendation for the already-published May 12 issue: after this fix is deployed, use the admin Issue Desk append workflow to add the strongest remaining May 12 candidates to Issue 12, then verify the public page, RSS/feed, sitemap, and metadata. Do not republish or edit production data from tests.

# Task: Cloud Google Alerts Candidate Import

- [x] Confirm the current local Codex automation shape and existing repo cron/workflow options.
- [x] Add a cloud-safe Google Alerts fetch, filter, output, dry-run, and import script.
- [x] Add a GitHub Actions schedule for the evening candidate import.
- [x] Verify the new script and workflow wiring locally without mutating production data.
- [x] Document remaining setup requirements, including required GitHub secrets and push status.

## Plan

Use GitHub Actions instead of another Vercel cron because the repo already has multiple Vercel cron entries and this job is an external RSS import rather than an app-internal route. Schedule the workflow at the two UTC offsets that can represent 7:15 PM in America/Winnipeg, then gate the job on the runner's Winnipeg local hour so daylight saving time does not create two imports.

Keep the job read-mostly until the final candidate API POST. It should fetch RSS feeds from a GitHub secret, save a reviewable run artifact, dry-run the existing candidate importer, import only when candidates exist, and verify the candidate API is reachable.

## Review

- Added `scripts/google-alerts-candidate-import.mjs` as the cloud-friendly equivalent of the local Codex automation. It reads feed URLs from `GOOGLE_ALERTS_FEED_URLS` in CI, falls back to local `tmp/` artifacts outside CI, fetches Atom/RSS feeds, filters noise, writes timestamped review files, dry-runs the existing importer, and imports only when `--import` is passed.
- Updated `scripts/import-candidates-from-automation-output.mjs` so cloud imports can authenticate with `ARTICLE_CANDIDATE_INGEST_TOKEN`, `CRON_SECRET`, or `ADMIN_PASSWORD`.
- Added `.github/workflows/evening-google-alerts-candidates.yml`, scheduled at `15 0 * * *` and `15 1 * * *` UTC with an America/Winnipeg hour gate so the cloud run tracks 7:15 PM across daylight and standard time.
- Added `npm run import:google-alerts` for local dry-runs.
- Verification passed: script syntax checks, `npm run lint`, a safe local Google Alerts dry-run with 13 feeds / 254 raw entries / 8 curated candidates at test limit, `npm run test -- tests/lib/article-candidates.test.ts`, `npm run build`, and `git diff --check` for the touched paths with line-ending warnings only.
- GitHub Actions secrets configured for `scott-cmd11/ai-this-week`: `GOOGLE_ALERTS_FEED_URLS` and `ADMIN_PASSWORD`. The local `CRON_SECRET` value was effectively empty, so the workflow uses the supported admin-password auth path.
- Remaining setup: the workflow file will not actually run in GitHub cloud until these repo changes are pushed.

# Task: AI Good News High-End Meadow Design Pass

- [x] Read project instructions, README, positive AI route files, shared header, current global styles, relevant Next.js App Router/public asset docs, and the frontend-design skill.
- [x] Copy the generated optimistic Meadow image into `public/images/ai-good-news/` as a project asset.
- [x] Make Meadow the default positive AI visual direction without a palette query string.
- [x] Integrate the image into `/positive-ai` as a polished responsive editorial masthead.
- [x] Keep archive, about, and story detail pages visually consistent with the positive section.
- [x] Validate lint, build, TypeScript, tests, smoke checks, old seed exclusion, and desktop/mobile screenshots.
- [x] Review the diff for unrelated changes and document results.

## AI Good News Meadow Design Notes

Use a warm paper, fresh green, and restrained golden palette. The page should feel like a credible daily newspaper for useful AI progress: optimistic, human, source-linked, and easy to scan. Preserve the current last-24-hours-only article rule, ingestion/data model, admin flow, and sitemap behaviour.

## AI Good News Meadow Design Review

- Copied the generated optimistic image into `public/images/ai-good-news/meadow-human-progress.png`.
- Set the positive AI layout to `good-news-theme-meadow` and removed the homepage palette query handling so `/positive-ai` opens in Meadow by default.
- Reworked the `/positive-ai` hero into an editorial masthead with the image as a responsive art-directed background, a warm green overlay, source-linked positioning, and a compact story-file strip.
- Tuned the scoped Meadow tokens, category chips, archive rows, story tags, and related-story hover states so archive, about, and story detail pages stay consistent with the positive section.
- Preserved the current story recency, data model, ingestion, admin, and sitemap behaviour.

## AI Good News Meadow Validation Results

- `npm run lint` passed.
- `npm run test -- tests/lib/good-news-scoring.test.ts tests/lib/good-news-dedupe.test.ts tests/lib/good-news-digest.test.ts` passed: 3 files, 5 tests.
- `npm test` passed: 17 files, 68 tests.
- `npx tsc --noEmit` passed.
- `npm run build` passed and included the positive AI public/admin/API routes.
- Local smoke checks passed for `/positive-ai`, `/positive-ai/archive`, `/positive-ai/about`, `/positive-ai/stories/seed-mattersim-materials-ai`, and `/positive-ai/stories/seed-alphafold-3-server` returning `404`.
- Confirmed `/positive-ai` and `/positive-ai/archive` show MatterSim and do not show AlphaFold; `/sitemap.xml` also does not surface AlphaFold.
- Clean production-build screenshots saved at `tasks/screenshots/ai-good-news-meadow-desktop.png` and `tasks/screenshots/ai-good-news-meadow-mobile.png`.
- `git diff --check` passed with line-ending warnings only.

# Task: AI Good News MVP

- [x] Inspect the existing AI Today repo, positive AI route, admin auth pattern, source ingestion paths, and Supabase-oriented storage conventions.
- [x] Add the AI Good News data model, seed data, scoring, dedupe, summarizer, digest, store, and ingestion modules.
- [x] Build the public AI Good News homepage, story detail page, archive page, and about page.
- [x] Build the password-protected MVP admin review page with pending review, approve/reject/edit, manual URL add, ingestion trigger, and digest trigger.
- [x] Add API routes, a Vercel cron hook, editable source config, Supabase schema, ingestion script, README instructions, and focused tests.
- [x] Validate with scoring/dedupe/digest tests, full tests, lint, build, local smoke checks, and visual QA captures.

## AI Good News MVP Plan

Fold the stronger `AI Good News` concept into the existing `/positive-ai` branch of AI Today. Keep the rest of the site and daily issue workflow intact. The MVP should have its own story model, seed stories, source config, scoring rules, daily digest generation, archive/detail pages, and a lightweight admin desk protected by `AI_GOOD_NEWS_ADMIN_PASSWORD` or the existing `ADMIN_PASSWORD`.

Use Supabase REST persistence when `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are configured and the new tables exist. Fall back to seeded in-memory data for local MVP review so the public pages work without live credentials. Do not push, deploy, mutate production data, or touch the pre-existing issue-summary work.

## AI Good News MVP Review

- Added a dedicated AI Good News story model, seed data set, scoring rules, deduplication, digest ranking, mock summarizer interface, RSS ingestion module, and Supabase/in-memory store.
- Rebuilt `/positive-ai` as the AI Good News homepage, with category filters, today's digest, source-linked story rows, credibility signals, and a calm positive-only reader tone.
- Added `/positive-ai/stories/[id]`, `/positive-ai/archive`, and `/positive-ai/about`.
- Added `/positive-ai/admin` with password-protected pending/published review, publish/approve/reject actions, summary edit, manual URL add, ingestion trigger, and digest generation trigger.
- Added admin APIs, cron route, editable RSS source config, Supabase schema, dry-run ingestion script, sitemap entries, README setup notes, and tests for scoring, dedupe, and digest generation.
- Saved visual QA captures at `tasks/screenshots/ai-good-news-desktop.png` and `tasks/screenshots/ai-good-news-mobile.png`.
- Follow-up correction: the public AI Good News surfaces now enforce a 24-hour current-news window. Older seed examples no longer appear on the homepage, archive, story detail pages, digest, or sitemap. The local fallback now includes one source-linked May 12, 2026 Microsoft Research story so the page shows a genuinely current item.
- Follow-up colour exploration: positive pages now have a scoped warmer colour system. `/positive-ai` defaults to `sunrise`, with homepage preview URLs for `?palette=meadow` and `?palette=sky` so the colour direction can be compared without changing the rest of AI Today.

## AI Good News MVP Validation Results

- `npm run test -- tests/lib/good-news-scoring.test.ts tests/lib/good-news-dedupe.test.ts tests/lib/good-news-digest.test.ts` passed: 3 files, 5 tests.
- `npm test` passed: 17 files, 68 tests.
- `npm run lint` passed after cleanup.
- `npm run build` passed and included `/positive-ai`, `/positive-ai/archive`, `/positive-ai/about`, `/positive-ai/admin`, `/positive-ai/stories/[id]`, and the positive AI API/cron routes.
- `npx tsc --noEmit` passed.
- `node scripts/ingest-ai-good-news.mjs --dry-run` checked 4 sources, found 34 candidates, and reported one source-level RSS block from NOAA Research with HTTP 403.
- Local smoke checks passed for `http://localhost:3036/positive-ai`, `/positive-ai/archive`, `/positive-ai/about`, `/positive-ai/stories/seed-alphafold-3-server`, `/positive-ai/admin`, and `/sitemap.xml`.
- Admin API without a password returned `401`.
- Reader-facing positive AI content was scanned for excluded negative phrases after the final copy pass; no matches were found in `app/positive-ai` or the seed story data.
- Follow-up validation after the current-news correction:
  - `npm run test -- tests/lib/good-news-digest.test.ts tests/lib/good-news-scoring.test.ts tests/lib/good-news-dedupe.test.ts` passed.
  - `npm test` passed: 17 files, 68 tests.
  - `npm run lint`, `npm run build`, and `npx tsc --noEmit` passed.
  - `node scripts/ingest-ai-good-news.mjs --dry-run` now reports 1 candidate inside the 24-hour window and still reports NOAA Research HTTP 403 as a source-level warning.
  - Local smoke checks confirm `/positive-ai`, `/positive-ai/archive`, `/positive-ai/stories/seed-mattersim-materials-ai`, and `/sitemap.xml` include MatterSim, while `/positive-ai/stories/seed-alphafold-3-server` returns `404`.
  - Updated visual capture saved at `tasks/screenshots/ai-good-news-current-only-desktop.png`.
- Colour preview validation:
  - `npm run lint`, `npm run build`, and `npx tsc --noEmit` passed after adding the scoped palette styles.
  - Local palette captures saved at `tasks/screenshots/ai-good-news-palette-sunrise.png`, `tasks/screenshots/ai-good-news-palette-meadow.png`, and `tasks/screenshots/ai-good-news-palette-sky.png`.

# Task: Positive AI Stories Section

- [x] Read `AGENTS.md`, `README.md`, `package.json`, `docs/visual-system.md`, public route files, issue-store parsing, and existing task lessons.
- [x] Confirm existing dirty files and avoid unrelated edits.
- [x] Add a documented positive-only story filter with explicit allowed and excluded editorial signals.
- [x] Add a public positive AI stories route that uses the existing AI Today visual system.
- [x] Make the new section clearly discoverable from the main website.
- [x] Add focused tests for positive inclusion, negative exclusion, and issue-story parsing.
- [x] Validate with lint, tests, build, and local route smoke checks.

## Positive Stories Plan

Build a new reader-facing route for constructive AI stories using the existing published issue store. The route should only show stories that pass a strict positive-benefit filter, and it should skip anything with job-loss, fear, safety-failure, lawsuit, surveillance, misinformation, military, displacement, or other negative framing signals. Keep the route calm, source-linked, and editorial rather than hype-driven.

## Positive Stories Non-Goals

- No production deploy, git push, Vercel change, secret change, or live data mutation.
- No broad redesign of AI Today.
- No changes to the existing issue summary work in `lib/issue-summary.ts` or its test, which were already dirty at task start.

## Positive Stories Review

- Added `lib/positive-stories.ts` with one strict editorial gate for constructive AI coverage. The filter requires at least one positive theme and blocks job-loss, risk, scam, lawsuit, bias, misinformation, surveillance, military, safety-failure, and fear-framed stories.
- Added `/positive-ai` as a new public route using the existing AI Today ruled editorial layout, source-linked story rows, theme labels, and a constructive empty state for environments without issue data.
- Added the Positive AI link to the main header and included `/positive-ai` in the sitemap.
- Added `tests/lib/positive-stories.test.ts` for positive inclusion, excluded framing, and parsing published issue blocks.
- Saved desktop and mobile visual QA captures in `tasks/screenshots/positive-ai-desktop.png` and `tasks/screenshots/positive-ai-mobile.png`.

## Positive Stories Validation Results

- `npm run test -- tests/lib/positive-stories.test.ts` passed.
- `npm run lint` passed.
- `npm test` passed: 14 test files, 63 tests.
- `npm run build` passed and included `/positive-ai` as a static route with 5 minute revalidation.
- `npx tsc --noEmit` passed.
- Local smoke checks passed for `http://localhost:3036/positive-ai`, `/`, and `/sitemap.xml`.
- Playwright visual checks passed at desktop `1440x1100` and mobile `390x844`. The dev-only Next toolbar was removed from the saved screenshots.

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
