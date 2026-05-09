-- AI Today article candidate inbox.
-- Run this in the Supabase SQL editor before enabling /api/article-candidates.

create extension if not exists pgcrypto;

create table if not exists public.article_candidates (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  url text not null,
  canonical_url text not null unique,
  summary text,
  source text not null default 'Unknown source',
  source_type text not null default 'other'
    check (source_type in ('google_alerts', 'canada_briefing', 'ai_voices', 'research', 'agriculture', 'manual', 'other')),
  published_at timestamptz,
  category text not null default 'Industry & Models'
    check (category in ('Canada', 'Policy & Regulation', 'Government & Public Sector', 'Industry & Models', 'Sectors & Applications', 'Research')),
  status text not null default 'new'
    check (status in ('new', 'shortlisted', 'approved', 'rejected', 'imported')),
  score integer not null default 0 check (score >= 0 and score <= 100),
  score_reasons text[] not null default '{}',
  rejection_reason text,
  reviewed_at timestamptz,
  imported_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.article_candidates enable row level security;

-- The app uses SUPABASE_SERVICE_ROLE_KEY only from server-side Next.js routes.
-- No browser client reads this table directly.
grant select, insert, update, delete on table public.article_candidates to service_role;

drop policy if exists "Service role manages article candidates" on public.article_candidates;
create policy "Service role manages article candidates"
  on public.article_candidates
  for all
  to service_role
  using (true)
  with check (true);

create index if not exists article_candidates_status_score_idx
  on public.article_candidates (status, score desc, created_at desc);

create index if not exists article_candidates_published_at_idx
  on public.article_candidates (published_at desc);
