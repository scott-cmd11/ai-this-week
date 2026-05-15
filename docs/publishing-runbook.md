# AI Today Publishing Runbook

## Normal 8 PM Winnipeg Routine

The site now has a nightly autopublish controller for nights when no editor is available. The manual routine is still useful when you want editorial review.

1. Run the read-only preflight:

   ```powershell
   npm run preflight:publishing -- --strict
   ```

2. Open `/admin` and use `Tonight's Issue` as the primary desk.
3. Check the top preflight and evening briefing state:
   - Source run should be fresh for today's America/Winnipeg issue date.
   - Candidate pool target is 35 usable candidates.
   - Strong candidate target is 8.
   - Normal publish target is 8 articles.
   - Normal publish blocks below the minimum article count unless the deliberate short-issue override is used.
4. Review candidates, import/select the strongest items, edit the draft, and read the publish checklist.
5. Publish only when preflight, source freshness, candidate volume, and publish gates are understandable and acceptable.

## Nightly Autopublish

- Vercel runs `/api/cron/autopublish` at `30 2 * * *`, after the evening candidate intake window.
- Autopublish assembles the draft, fills it with high-score active candidates when needed, rechecks readiness, and publishes only when source freshness is current and the draft has at least the minimum article count.
- It fails closed for missing drafts, stale or missing source runs, very thin drafts, readiness blockers, stale source warnings, weak titles, and similar-topic warnings.
- It can tolerate normal editorial polish warnings such as missing images, uneven section balance, held candidates, or old imported-candidate traceability warnings when the issue is otherwise publishable.
- Use the dry-run check when you want to see what vacation mode would do without writing data:

  ```powershell
  npm run preflight:publishing -- --strict
  ```

## If Candidate Volume Is Low

1. Do not publish just because the draft exists.
2. Check whether the evening Google Alerts workflow exists on the default GitHub branch and is active:

   ```powershell
   npm run preflight:publishing -- --strict
   ```

3. In `/admin`, open `Tools` and retry or inspect source intake.
4. Refresh `Tonight's Issue` and confirm whether the latest candidate activity belongs to today's Winnipeg issue date.
5. If the issue is already published and active candidates remain, use `Issue Desk` to add or repair the live issue.
6. Use the intentional short-issue override only for a clear editorial decision, not because the source pipeline is stale.

## Editing A Published Issue

Use top-level `Issue Desk` for live issue work:

- Add an article to an already-published issue.
- Edit article title, summary, section, URL, image, or source details.
- Remove an item only after confirmation.
- Add correction or append notes when the public record needs context.
- Recheck the public issue page after any live edit.

## Deploy Verification Checklist

Run these checks after a deploy and before trusting the daily publishing flow:

- `npm run preflight:publishing -- --api-base https://aitoday.vercel.app --strict`
- `/admin` loads and shows `Tonight's Issue`, `Issue Desk`, and `Tools`.
- `/api/admin/today-status` returns a `preflight`, `eveningBriefing`, candidate counts, draft state, blockers, and warnings.
- `/api/article-candidates` is reachable in read-only mode.
- `/api/cron/daily-publish` dry-run POST returns a skipped or publishable result without publishing.
- `/api/cron/autopublish` dry-run POST returns a skipped or publishable result without publishing.
- `vercel.json` still contains daily assemble and nightly autopublish cron entries.
- Required scheduled GitHub workflows are present and active on the default branch, not only on a feature branch.
- A current or recent `/issues/YYYY-MM-DD` page renders.

## Do Not Publish When

- The evening source run is stale or missing.
- Required scheduled workflows are missing from the default branch.
- Candidate volume is unexpectedly low and the cause is not understood.
- The draft is below the minimum article count without a deliberate short-issue override.
- Imported candidates cannot be traced to issue/date context.
- A live issue is thin while active candidates remain available.
