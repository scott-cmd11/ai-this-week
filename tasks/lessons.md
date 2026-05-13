# Lessons

- When reviewing an admin workflow, verify where the real state-changing action lives. A final "complete" button must not imply that publishing happened unless it actually changes the issue's published state.
- Keep post-publication updates visibly separate from the daily publishing path. Editors should not have to infer the difference between "publish today's draft" and "append to an already-live issue."
- Before publishing, surface content-quality warnings in the admin review step, especially truncated titles from imported briefing text.
- Daily admin workflows must use the publication timezone for "today." Do not use UTC ISO dates for issue imports, draft lookup, or publish jobs because evening Central time can become tomorrow in UTC.
- Briefing import rows must never be keyed only by URL. Some source briefings provide generic source homepage links, so use row-specific keys and title/topic duplicate checks as a second guardrail.
- Public issue rendering should hide operational sections such as `Repair Note`; Notion can hold internal repair context, but reader-facing pages should only render briefing content.
- Public issue summary slots should gracefully derive copy from the issue contents when the saved summary field is empty; the homepage and issue detail page should not leave the space blank for live published issues.
- Issue summaries should read like editorial hooks, not section inventories. Lead with the main theme and why it matters, then support it with key developments.
- Published issue edits must be a first-class admin step with in-site controls. A repeated side panel is too easy to miss and makes live corrections feel separate from the real publishing process.
- Destructive live issue actions need inline confirmation and must remove the complete Notion item block group, not only the visible title or summary block.
- Avoid public homepage copy that explains the daily publishing schedule as a status line. It can read like something is missing; keep publication timing out of the main issue ledger unless there is a clearly designed status treatment.
- Duplicate-prevention fixes must cover both manual admin imports and scheduled assemble jobs. If only the visible import panel has the guardrail, repeats can already be in the draft before review.
- Daily news surfaces must not use historical seed stories as public fallback content. Keep fixtures out of the reader view unless their `published_at` falls inside the explicit current-news window.
