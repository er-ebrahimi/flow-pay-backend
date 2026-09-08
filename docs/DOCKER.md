# Docker — FlowPay Backend

Containerized setup for the FlowPay API and its PostgreSQL database.

## Files

| File | Purpose |
|---|---|
| `Dockerfile` | Multi-stage build: compiles the NestJS app + Prisma contract, then copies only production artifacts into a slim `node:22-alpine` runtime image (~90MB). |
| `docker-compose.yml` | Two services: `db` (Postgres 16) and `api` (built from the Dockerfile). |
| `.dockerignore` | Excludes `node_modules`, `dist`, `.env`, tests, and editor files from the build context. |

## Quick start

```bash
docker compose up -d
```

This builds the API image (if needed) and starts both services:

| Service | Image | Host port | Internal port |
|---|---|---|---|
| `db` | `postgres:16-alpine` | `5434` | `5432` |
| `api` | built from `Dockerfile` | `3002` | `3000` |

Override the published ports with the `DB_PORT` / `API_PORT` environment variables — the defaults avoid clashes with a local Postgres (typically 5433) and a local dev server (typically 3000).

## Initialize the database

The containers create an empty database. Apply the schema from the host:

```bash
DATABASE_URL="postgresql://flowpay:flowpay_dev_pass@localhost:5434/flowpay?schema=public" npx prisma db update
```

`prisma db update` applies **contract operations only** — tables, indexes, and foreign keys. It does not replay the raw-SQL data migrations (currency seed, guardrail check constraints, default exchange rates). For a fully seeded database, also run the data migrations by hand after `db update` — see *Data migrations* below.

## Data migrations

Two committed data migrations live under `migrations/app/`:

| Migration | What it does |
|---|---|
| `20260906T2115_flowpay_guardrails_seed` | Seeds USD/EUR/GBP/AED currencies and adds CHECK constraints (same-currency pair guard on quotes/rates/transactions, `balance >= 0`, `sourceAmount > 0`, `amount > 0`). |
| `20260908T1446_flowpay_default_exchange_rates` | Seeds a 1:1 default rate for every ordered pair of the seeded currencies. |

Because these are raw SQL (not contract operations), they are **not** applied by `prisma db update`. Apply them with a small script or `psql`:

```bash
# against the Docker DB from the host
DATABASE_URL="postgresql://flowpay:flowpay_dev_pass@localhost:5434/flowpay?schema=public" node seed.mjs
```

> **Warning:** the guardrail CHECK constraints are not part of the contract. A later `prisma db update` may propose dropping them as "destructive operations" — never consent blindly.

## Dockerfile stages

```
build  →  node:22-alpine + npm ci + contract:emit + nest build
runtime →  node:22-alpine + npm install --omit=dev + copy dist/
```

The runtime stage runs as a non-root user (`appuser`, uid 1001) and exposes port 3000.

## Common commands

```bash
docker compose up -d --build     # rebuild the API image and start
docker compose down              # stop (keeps the db_data volume)
docker compose down -v           # stop and delete the database volume
docker compose logs -f api       # follow API logs
docker compose logs -f db        # follow database logs
docker compose exec api sh       # shell into the running API container
```

## Environment

The `api` service reads the same env vars as a local run (see `.env.example`):

| Variable | Default in compose |
|---|---|
| `DATABASE_URL` | `postgresql://flowpay:flowpay_dev_pass@db:5432/flowpay?schema=public` |
| `JWT_SECRET` | `please-change-me-in-production` |
| `JWT_EXPIRES_IN` | `1d` |
| `EXCHANGE_RATE_DEFAULT` | `1` |
| `CORS_ORIGINS` | `http://localhost:3000,http://localhost:3001` |

Override any of them in `docker-compose.yml` or via an env file.

## Production notes

- Set a strong `JWT_SECRET` (64+ random chars) — the default is not safe for production.
- The runtime image has no Prisma CLI; run `prisma db update` from the host or a CI job, not from inside the container.
- Migrations are snapshot-style and committed to git — `prisma db update` replays them against the target database.
