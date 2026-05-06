# Lessons

- When reviewing an admin workflow, verify where the real state-changing action lives. A final "complete" button must not imply that publishing happened unless it actually changes the issue's published state.
- Keep post-publication updates visibly separate from the daily publishing path. Editors should not have to infer the difference between "publish today's draft" and "append to an already-live issue."
- Before publishing, surface content-quality warnings in the admin review step, especially truncated titles from imported briefing text.
- Daily admin workflows must use the publication timezone for "today." Do not use UTC ISO dates for issue imports, draft lookup, or publish jobs because evening Central time can become tomorrow in UTC.
- Briefing import rows must never be keyed only by URL. Some source briefings provide generic source homepage links, so use row-specific keys and title/topic duplicate checks as a second guardrail.
- Public issue rendering should hide operational sections such as `Repair Note`; Notion can hold internal repair context, but reader-facing pages should only render briefing content.
