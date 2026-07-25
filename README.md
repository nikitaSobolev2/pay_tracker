# PayTracker

Track earnings, spendings, and debts. Next.js + PostgreSQL + Prisma + Better Auth + shadcn/ui.

## Quick start (local)

1. Copy env: `cp .env.example .env` (Windows: copy `.env.example` `.env`)
2. Start Postgres: `docker compose up -d postgres` (host port **5433**)
3. Install: `npm install`
4. Migrate: `npm run db:deploy`
5. Fetch FX rates: `npm run fx:fetch`
6. Dev server: `npm run dev` → [http://localhost:3000](http://localhost:3000)

## Docker (full stack)

```bash
docker compose up --build
```

Services: `app` (Next.js), `postgres`, `fx-worker` (last 40 days on start + every 24h), `backup` (daily pg_dump, max 2).

## Stack

- Next.js App Router (TypeScript), Tailwind, shadcn/ui
- Better Auth (username + password)
- Prisma + PostgreSQL
- next-intl (en/ru), next-themes
- Zustand (fast-transaction offline queue)
- Frankfurter FX rates (canonical amounts in RUB)

## Scripts

| Script | Purpose |
|--------|---------|
| `npm run dev` | Dev server |
| `npm run build` / `start` | Production |
| `npm run db:deploy` | Apply migrations |
| `npm run fx:fetch` | Backfill last 40 days of FX rates (upsert) |
