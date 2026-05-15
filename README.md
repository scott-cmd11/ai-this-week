This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

## AI Good News MVP

`/positive-ai` is a self-contained AI Good News MVP inside the AI Today app. It publishes positive, evidence-based AI stories with source links, dates, categories, summaries, why-it-matters notes, credibility scores, positivity scores, and evidence checks. Public reader surfaces prefer stories published in the last 24 hours, with a one-time 48-hour fallback when the strict daily window has no qualifying story; historical seed examples must stay out of the daily view.

### Local development

```bash
npm install
npm run dev -- --port 3036
```

Open `http://localhost:3036/positive-ai`.

### Environment variables

- `AI_GOOD_NEWS_ADMIN_PASSWORD` - password for `/positive-ai/admin`. Falls back to `ADMIN_PASSWORD` if unset.
- `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` - optional for local review, required for deployed persistence.
- `CRON_SECRET` - protects `/api/cron/positive-ai-digest`.

Without Supabase, the MVP uses seeded in-memory data so public pages can be reviewed locally. The public seed includes a current source-linked story and keeps older examples out of current reader surfaces.

### Database setup

Apply `docs/supabase/ai_good_news.sql` in Supabase to create:

- `public.ai_good_news_stories`
- `public.ai_good_news_digests`

The server writes with the service role. Public reads are limited to published AI Good News stories and digest rows.

### Sources and ingestion

Editable RSS sources live in `config/ai-good-news-sources.json`. Prefer RSS feeds, public APIs, and openly available metadata. Do not add aggressive scraping targets. The current source mix includes direct institutional feeds plus Google News RSS discovery feeds for health, education, accessibility, science, climate, safety, public good, and small business so the desk can search broadly without scraping pages.

The positive-AI source mix intentionally looks for AI at its most useful: health care, accessibility, education, scientific discovery, climate and energy, public service, safety, small business productivity, creativity, and Canadian innovation. Broad feeds are allowed only when the scoring layer can still confirm clear AI relevance; a positive story about technology, accessibility, or small business is not enough unless AI is actually part of the benefit.

Run a safe dry-run:

```bash
node scripts/ingest-ai-good-news.mjs --dry-run
```

The admin page can also trigger ingestion and daily digest generation manually. Ingestion and digest generation prefer the last 24 hours. If that strict window has no qualifying high-confidence story, they expand once to the last 48 hours and keep the story date visible.

### Editorial rules

AI Good News highlights positive, verifiable AI stories. It avoids hype, stock-market news, unsupported claims, pure product marketing, fear-led coverage, duplicate syndicated articles, and generic funding announcements without a public-good angle. Use cautious wording such as "may help," "is being used to," "early results suggest," and "researchers report" unless the source proves a stronger claim.
