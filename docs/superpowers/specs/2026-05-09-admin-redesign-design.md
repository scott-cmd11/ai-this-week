# AI Today Admin Redesign Design

## Purpose

Redesign the AI Today admin from the ground up around one primary job: help the editor publish today's issue with the least friction and the fewest mistakes.

The current admin exposes too many legacy panels and side workflows at once. The new model should make daily publishing feel guided, calm, and confidence-building while still preserving powerful tools for editing existing issues, scheduling future items, and checking system health.

## Approved Direction

The default admin model is **Guided Daily Run**.

The primary path is:

1. Intake
2. Choose
3. Edit
4. Check
5. Publish

The admin opens on **Today's Run Status**, then starts the guided daily run. The working mode is a **hybrid**: step-by-step by default, with an expandable full desk when the editor needs to jump around.

Secondary areas exist, but they do not compete with the daily publishing path:

- Issue Desk
- Future Queue
- Health
- Settings

## Admin Home: Today's Run Status

The first screen after sign-in should orient the editor before asking them to act. It should answer:

1. Did the automations run?
2. How many candidates are waiting?
3. Is there already a draft?
4. Are there blocking warnings?
5. What is the next best action?

### Top Status

Show:

- Issue date, for example `Saturday, May 9`
- Draft state:
  - Not started
  - In progress
  - Ready to check
  - Published
- One primary action:
  - `Start today's issue`
  - `Continue today's issue`
  - `Review checks`
  - `View published issue`

### Readiness Cards

Show four compact cards:

- **Automations**: last run time, sources processed, failures
- **Candidates**: new, top picks, held, rejected, imported
- **Draft**: article count, represented sections, missing summaries
- **Checks**: blocker count and warning count

### Next Best Action

Show one plain-language instruction:

- `Review 47 candidates from today's automations.`
- `Draft has 12 articles. Fix 2 warnings before publishing.`
- `Issue is published. Use Issue Desk for corrections.`

No editing happens on this screen. It is orientation plus the next action.

## Daily Run

The daily run is the default work path.

### Intake

Purpose: confirm that the day's sources arrived.

Show:

- Last automation run
- Candidate count
- Source failures, if any
- A clear path to continue into candidate review

This step should not expose legacy briefing import by default. Legacy/import fallback tools belong in Settings or Health.

### Choose

Candidate review uses editorial triage, not checkbox-first importing.

Candidate filters:

- Top picks
- Needs review
- Held
- Rejected
- Imported

Candidate cards show:

- Title
- Source
- Summary
- Score/recommendation reason
- Category
- Source freshness
- Duplicate/topic warnings

Primary actions:

- **Keep**: adds the item to today's draft immediately and marks it used
- **Reject**: removes it from today's active queue
- **Hold**: sends it to Future Queue

System support:

- Recommended labels for high-scoring candidates
- Possible-repeat warnings from issue memory
- Older-source warnings
- Weak-title warnings

The editor makes one clear decision per candidate. The system helps, but the UI should not feel automated or spreadsheet-like.

### Edit

Draft editing uses split view on desktop.

Left side: structured editor.

- Sections in issue order
- Compact editable article/event items
- Edit title
- Edit summary
- Change section
- Remove item
- Reorder within section
- Open source
- Add article
- Add learning event
- Add research/context

Right side: live public-style preview.

- Looks close to the public issue page
- Updates after saves/imports
- Shows section headings, summaries, source links, and images
- Shows a public issue link once published

Mobile:

- Tabs: Edit, Preview, Checks
- Default to Edit first

Candidate review decides what enters the draft. Draft editing decides how the issue reads.

### Check

The Check step is the confidence layer before publishing.

Checks are split into blockers and warnings.

#### Blockers

Publishing is disabled until these are fixed:

- No articles
- Exact duplicate URL
- Missing title
- Missing summary
- Broken required source URL
- Draft save failure
- Publish readiness failure

#### Warnings

Warnings require acknowledgement but do not block publishing:

- Similar topic from recent issue
- Stale or older source date
- Weak title
- Missing image
- Uneven section balance
- Held candidates still unresolved
- Very low article count

### Publish

Publish screen shows:

- Issue date
- Article count
- Blockers
- Warnings
- Final public destination

Button states:

- `Fix blockers first`
- `Acknowledge warnings and publish`
- `Publish issue`

After publishing, show:

- Public issue link
- Issue Desk link for corrections
- Optional future space for email/social generation

Publishing should feel like a final checklist, not a leap of faith.

## Secondary Areas

Secondary areas are organized by job, not by legacy component history.

### Issue Desk

For editing a specific issue.

Capabilities:

- Choose draft, published, or future issue
- Add article
- Add learning event
- Edit title
- Edit summary
- Remove item
- Reorder items
- View public issue when published

This replaces the scattered "Add to Issue" and "Live issue desk" feeling.

### Future Queue

For held or scheduled items.

Contains:

- Held candidates from candidate review
- Items scheduled for future issue dates

Actions:

- Add to today
- Schedule for date
- Discard
- Open source

Held items must not disappear into a hidden filter.

### Health

For operational confidence.

Show:

- Last automation run
- Candidate ingestion count
- Source failures
- Supabase status
- Publish/API errors
- Cron status when available

### Settings

For rare changes.

Show:

- Capture settings
- Tokens/URLs display
- Source configuration
- Legacy Notion fallbacks, if retained

## Data And Flow Requirements

The redesign should continue using Supabase as the publishing source of truth.

Main entities:

- `article_candidates`
- `issues`
- issue blocks/items
- future/held items, either as candidate statuses or a dedicated future queue model

The daily flow should avoid Notion as a publishing dependency. If Notion remains for input-side legacy sources, it must be labelled as fallback/legacy and kept outside the main daily path.

## Error Handling

The admin should make failures visible in plain language.

Examples:

- Automation did not run
- Candidate inbox is unavailable
- Supabase is not configured
- Source article could not be fetched
- Publish failed
- Duplicate/topic warning found
- Future item could not be scheduled

Failures should point to the next useful action, not just show raw API errors.

## Testing And Verification

Implementation should include:

- Unit tests for readiness/check logic
- Tests for issue-memory blocker/warning classification
- API tests or targeted route checks for append, publish, and candidate state transitions
- Browser checks for the main daily run:
  - home status loads
  - candidate Keep/Reject/Hold actions are visible
  - draft editor and preview render
  - check step shows blockers/warnings
  - publish button state changes correctly
- Mobile viewport checks for edit/preview/check tabs

## Non-Goals

This redesign does not need to add:

- A public-facing redesign
- Email/social generation as part of the first rebuild
- A new CMS
- A large analytics dashboard
- Self-serve source management

Those can be layered later after the daily publishing path is calm and reliable.

## Implementation Notes

The current admin can be migrated incrementally:

1. Build the new admin shell and Today's Run Status.
2. Replace Candidate Inbox actions with Keep/Reject/Hold.
3. Build split-view draft editor.
4. Build the Check step.
5. Move Issue Desk, Future Queue, Health, and Settings into secondary areas.
6. Remove or hide legacy Notion-era panels from the primary path.

The first implementation milestone should prioritize the daily path over secondary power tools.
