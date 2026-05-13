create table if not exists public.ai_good_news_stories (
  id text primary key,
  title text not null,
  source_name text not null,
  source_url text not null,
  canonical_url text not null unique,
  published_at timestamptz not null,
  discovered_at timestamptz not null default now(),
  summary text not null default '',
  why_it_matters text not null default '',
  category text not null,
  tags text[] not null default '{}',
  positivity_score integer not null default 0 check (positivity_score >= 0 and positivity_score <= 100),
  credibility_score integer not null default 0 check (credibility_score >= 0 and credibility_score <= 100),
  evidence_notes text not null default '',
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected', 'published')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists ai_good_news_stories_status_idx on public.ai_good_news_stories (status);
create index if not exists ai_good_news_stories_published_at_idx on public.ai_good_news_stories (published_at desc);
create index if not exists ai_good_news_stories_category_idx on public.ai_good_news_stories (category);

create table if not exists public.ai_good_news_digests (
  id text primary key,
  digest_date date not null unique,
  headline text not null,
  intro text not null,
  story_ids text[] not null default '{}',
  generated_at timestamptz not null default now()
);

alter table public.ai_good_news_stories enable row level security;
alter table public.ai_good_news_digests enable row level security;

drop policy if exists "Public can read published AI Good News stories" on public.ai_good_news_stories;
create policy "Public can read published AI Good News stories"
  on public.ai_good_news_stories
  for select
  using (status = 'published');

drop policy if exists "Public can read AI Good News digests" on public.ai_good_news_digests;
create policy "Public can read AI Good News digests"
  on public.ai_good_news_digests
  for select
  using (true);

-- Writes are performed by the server-side service role through the AI Good News admin and cron routes.
