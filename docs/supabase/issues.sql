-- AI Today issue publishing store.
-- Run this after article_candidates.sql to move draft/final publishing out of Notion.

create extension if not exists pgcrypto;

create table if not exists public.issues (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  issue_date date not null unique,
  issue_number integer not null unique check (issue_number > 0),
  published boolean not null default false,
  summary text,
  ai_assisted boolean not null default true,
  blocks jsonb not null default '[]'::jsonb,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.issues enable row level security;

grant select, insert, update, delete on table public.issues to service_role;

drop policy if exists "Service role manages issues" on public.issues;
create policy "Service role manages issues"
  on public.issues
  for all
  to service_role
  using (true)
  with check (true);

create index if not exists issues_published_date_idx
  on public.issues (published, issue_date desc);

create index if not exists issues_updated_at_idx
  on public.issues (updated_at desc);
