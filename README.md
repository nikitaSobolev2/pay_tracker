# PayTracker

Track earnings, spendings, and debts. Next.js + PostgreSQL + Prisma + Better Auth + shadcn/ui.

## Quick start (local)

1. Copy env: `cp .env.example .env` (Windows: copy `.env.example` `.env`)
2. Start Postgres: `docker compose up -d postgres` (host port **5433**)
3. Install: `npm install`
4. Migrate: `npm run db:deploy`
5. Fetch FX rates: `npm run fx:fetch`
6. Dev server: `npm run dev` → [http://localhost:3000](http://localhost:3000)

Uploads go to `.data/files` and are served at `http://localhost:3000/files/...`. You do not need MinIO.

## Docker (full stack)

```bash
docker compose up --build
```

Services: `app` (Next.js) and `postgres`. FX rates: `npm run fx:fetch` (or the host cron in production). Uploads: `./data/files`.

## Production deploy (Ubuntu 22)

Use `scripts/deploy-ubuntu.sh` with `docker-compose.prod.yml`. The script detects preinstalled Docker, installs Engine/Compose only if missing, writes a production `.env`, and manages the stack. Postgres is not published to the host. The app listens on `APP_HOST:APP_PORT` (default loopback `:3000` behind nginx).

Image (later, GHCR): `ghcr.io/nikitasobolev2/pay_tracker`. This month you can ignore GHCR and keep building on the server.

### This month — current 4 GB server (no GitHub Actions)

Operator habit stays the same. After this code is on the machine:

1. Optional once: `./scripts/deploy-ubuntu.sh export` and copy the zip off the box.
2. `./scripts/deploy-ubuntu.sh redeploy` — `git pull`, **build on the server**, start Postgres + app. MinIO / fx-worker / backup containers are removed. Host cron is installed for FX and SQL dumps. Leftover MinIO objects are copied into the files volume if that volume is empty.
3. HTTPS / nginx is unchanged. If you already use a `files.` subdomain, keep the existing `S3_PUBLIC_URL` and run `sudo ./scripts/setup-nginx.sh files` so that host proxies to the app `/files` route (tickets stay 404 on that vhost).
4. Do **not** run `light-redeploy` until the GHCR package is public and you intend to stop building on the server.

`redeploy` does not need GitHub Container Registry, `docker login`, or Actions.

### Later — 2 GB VPS with GHCR (after this month)

Set GitHub Actions **Variables** to the same `NEXT_PUBLIC_*` values as production `.env`:

- `NEXT_PUBLIC_DEFAULT_CURRENCIES`
- `NEXT_PUBLIC_APP_NAME`
- `NEXT_PUBLIC_YANDEX_MAPS_API_KEY`

Push `main` (or run the **Publish image** workflow). After the first package exists, GitHub → Packages → `pay_tracker` → Change visibility → **Public** (GitHub often creates packages as private). `light-redeploy` pulls that public image; it cannot build on the VPS. On a 2 GB host, `sudo ./scripts/deploy-ubuntu.sh install` creates a 2 GB swap file when RAM is under ~3.5 GB.

**Fresh 2 GB box** (GHCR package must already be **Public**)

```bash
chmod +x scripts/*.sh
sudo ./scripts/deploy-ubuntu.sh install
```

Docker group membership is not active in the same shell. Log out and back in (or run `newgrp docker`), then:

```bash
./scripts/deploy-ubuntu.sh configure
./scripts/light-redeploy.sh
sudo ./scripts/setup-nginx.sh setup
# only if the DB already has files.* cover URLs:
sudo ./scripts/setup-nginx.sh files
```

If GHCR is empty or still private, `./scripts/deploy-ubuntu.sh deploy` builds on the VPS (slow; uses swap). Do not run `light-redeploy` until the image exists.

**Move data from the 4 GB box**

1. On the old server, while it is up: `./scripts/deploy-ubuntu.sh export` — copy the zip off the box.
2. On the new server: configure (keep `BETTER_AUTH_SECRET` / `POSTGRES_PASSWORD` / existing `S3_PUBLIC_URL` if you have a files subdomain), then `./scripts/light-redeploy.sh`.
3. `./scripts/deploy-ubuntu.sh import /path/to/paytracker-….zip`

### First run (any Ubuntu 22 host)

```bash
chmod +x scripts/*.sh
sudo ./scripts/deploy-ubuntu.sh install   # skips Docker reinstall if already present
```

Log out and back in (or `newgrp docker`) so your user can use Docker without `sudo`, then:

```bash
./scripts/deploy-ubuntu.sh configure
./scripts/deploy-ubuntu.sh deploy         # this month: on-server build
```

Or run with no arguments for an interactive menu.

### HTTPS (nginx + Let's Encrypt)

The Docker app listens on port **3000**. For `https://your.domain` on 80/443:

```bash
chmod +x scripts/setup-nginx.sh
sudo ./scripts/setup-nginx.sh setup
```

Then set `BETTER_AUTH_URL=https://your.domain` and `S3_PUBLIC_URL=https://your.domain/files` (unless you already have a files subdomain), and `./scripts/deploy-ubuntu.sh redeploy`.

| Command | Purpose |
|---------|---------|
| `sudo ./scripts/setup-nginx.sh setup` | Install nginx/certbot, proxy, TLS certificate |
| `sudo ./scripts/setup-nginx.sh files` | Proxy an existing `files.*` host to `/files` (legacy MinIO URLs) |
| `sudo ./scripts/setup-nginx.sh status` | nginx + certificate status |
| `sudo ./scripts/setup-nginx.sh renew` | Renew certificates now |

### What `configure` asks for

- Public app URL (`BETTER_AUTH_URL`, e.g. `https://pay.example.com`)
- Bind host and port
- App name, currencies, timezone
- Generates `BETTER_AUTH_SECRET` and `POSTGRES_PASSWORD` (alphanumeric, safe in `DATABASE_URL`)

It also writes `STORAGE_DIR=/data/files` and asks for the public files URL (default `${BETTER_AUTH_URL}/files`, or the existing `S3_PUBLIC_URL` if you already have a files subdomain). Existing AI / Yandex / cron values are kept. `.env` is mode `600`. Existing files are backed up before overwrite.

### Day-to-day commands

| Command | Purpose |
|---------|---------|
| `./scripts/deploy-ubuntu.sh redeploy` | **This month:** `git pull` + build on the server (alias: `update`) |
| `./scripts/light-redeploy.sh` | **Later:** `git pull` + pull GHCR + restart (`deploy-ubuntu.sh light`) |
| `./scripts/deploy-ubuntu.sh deploy` | Build current tree and start (no git pull) |
| `./scripts/deploy-ubuntu.sh export` | Zip database + uploads into `./backups` |
| `./scripts/deploy-ubuntu.sh import <zip>` | Restore that zip (destructive; `--yes` skips confirm) |
| `./scripts/deploy-ubuntu.sh up` / `down` | Start / stop containers |
| `./scripts/deploy-ubuntu.sh status` | Container status |
| `./scripts/deploy-ubuntu.sh logs` | Follow app logs |
| `./scripts/deploy-ubuntu.sh help` | Full help |

Daily SQL dumps land in `./backups` via host cron (last seven `paytracker-*.sql` files, mode 600). Full zip snapshots are on demand via `export`. Import writes a `pre-import-*.sql` + files tarball first so a failed restore can be rolled back.

## Stack

- Next.js App Router (TypeScript), Tailwind, shadcn/ui
- Better Auth (username + password)
- Prisma + PostgreSQL
- next-intl (en/ru), next-themes
- Zustand (fast-transaction offline queue)
- Frankfurter FX rates (canonical amounts in RUB)
- Local disk for uploads (`/files/...` on the app)

## Scripts

| Script | Purpose |
|--------|---------|
| `npm run dev` | Dev server |
| `npm run build` / `start` | Production |
| `npm run db:deploy` | Apply migrations |
| `npm run fx:fetch` | Backfill last 40 days of FX rates (upsert) |
