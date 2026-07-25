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

## Production deploy (Ubuntu 22)

Use `scripts/deploy-ubuntu.sh` with `docker-compose.prod.yml`. The script detects preinstalled Docker (common on VPS images), installs Engine/Compose only if missing, writes a production `.env`, and manages the stack. Postgres is not published to the host; the app listens on `APP_HOST:APP_PORT` (default `0.0.0.0:3000`).

### First run

```bash
chmod +x scripts/deploy-ubuntu.sh
sudo ./scripts/deploy-ubuntu.sh install   # skips Docker reinstall if already present
./scripts/deploy-ubuntu.sh configure
./scripts/deploy-ubuntu.sh deploy
```

Or run with no arguments for an interactive menu.

`install` reports Docker/Compose/daemon status, starts the daemon if needed, and only installs Compose if Docker is present without it. After `install`, log out and back in (or run `newgrp docker`) so your user can use Docker without `sudo`.

### What `configure` asks for

- Public app URL (`BETTER_AUTH_URL`, e.g. `https://pay.example.com`)
- Bind host and port
- App name, currencies, timezone
- Generates `BETTER_AUTH_SECRET` and `POSTGRES_PASSWORD` (alphanumeric, safe in `DATABASE_URL`)

`.env` is written with mode `600`. Existing files are backed up before overwrite.

### Day-to-day commands

| Command | Purpose |
|---------|---------|
| `./scripts/deploy-ubuntu.sh deploy` | Build images and start the stack (migrations run on app boot) |
| `./scripts/deploy-ubuntu.sh redeploy` | `git pull` + rebuild & restart (alias: `update`) |
| `./scripts/deploy-ubuntu.sh up` / `down` | Start / stop containers |
| `./scripts/deploy-ubuntu.sh status` | Container status |
| `./scripts/deploy-ubuntu.sh logs` | Follow app logs |
| `./scripts/deploy-ubuntu.sh help` | Full help |

SQL dumps land in `./backups` (daily via the `backup` service).

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
