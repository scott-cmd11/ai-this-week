# Article Candidate Inbox Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move raw article intake out of fragile Notion digest pages and into a normalized review queue that the AI Today admin can control.

**Architecture:** Add a Supabase-backed `article_candidates` table accessed only through server-side Next.js routes. Automations can post normalized candidates to `/api/article-candidates`, editors can review them in `/admin`, and approved candidates flow into the existing Notion draft importer so publishing remains unchanged.

**Tech Stack:** Next.js App Router, TypeScript, Supabase PostgREST via server-side `fetch`, existing Notion draft import route, Vitest.

---

### Task 1: Candidate Model And Scoring

**Files:**
- Create: `lib/article-candidates.ts`
- Test: `tests/lib/article-candidates.test.ts`

- [ ] Define candidate statuses, source types, request payloads, and normalization helpers.
- [ ] Score candidates using source quality, freshness, Canada relevance, expert-source relevance, and weak-source penalties.
- [ ] Verify scoring and URL normalization with Vitest.

### Task 2: Supabase Storage Adapter

**Files:**
- Create: `lib/article-candidate-store.ts`
- Create: `docs/supabase/article_candidates.sql`
- Modify: `.env.local.example`

- [ ] Add server-only Supabase REST helpers using `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`.
- [ ] Add SQL for the `article_candidates` table, RLS, service-role grants, and useful indexes.
- [ ] Document required environment variables without exposing secrets.

### Task 3: Candidate API

**Files:**
- Create: `app/api/article-candidates/route.ts`
- Create: `app/api/article-candidates/[id]/route.ts`

- [ ] Add authenticated `GET` for admin review.
- [ ] Add authenticated `POST` for automations to upsert normalized candidates.
- [ ] Add authenticated `PATCH` for status/category/summary edits.

### Task 4: Admin Candidate Inbox

**Files:**
- Create: `app/admin/_candidate-inbox.tsx`
- Modify: `app/admin/page.tsx`

- [ ] Add an admin panel showing `New`, `Shortlisted`, `Approved`, and `Rejected` candidates.
- [ ] Let the editor approve/reject candidates and import approved items into today's draft through the existing importer.
- [ ] Mount the panel before the current briefing import so the new queue becomes the first review surface.

### Task 5: Verification

**Files:**
- Modify: `tasks/todo.md`

- [ ] Run targeted Vitest tests.
- [ ] Run TypeScript and lint.
- [ ] Build locally.
- [ ] Document what remains before converting the external Codex automations.
