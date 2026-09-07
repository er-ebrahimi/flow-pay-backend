# FlowPay Backend

A multi-currency wallet and exchange API built with NestJS 12 and Prisma Next on PostgreSQL. Users register with email and password, hold wallets in multiple currencies, move money between accounts, and get an aggregated dashboard of their balances and activity.

## What is this project?

FlowPay is the backend service for a payments product. It exposes a JSON REST API where:

- Users register and log in with email + password (bcrypt-hashed, JWT bearer tokens).
- Every route requires `Authorization: Bearer <jwt>` except `POST /auth/register` and `POST /auth/login` — auth is enforced by a global guard, with an opt-out `@Public()` decorator.
- Each user holds per-currency wallets with balances and transaction counts.
- Money can be transferred between users within a currency.
- A dashboard endpoint aggregates balances and recent activity.
- All errors return a uniform envelope: `{ "error": { "code", "message", "context?" } }`, produced by a centralized error-handling module (`src/error-handling/`) — domain exceptions extend `AppException` and are mapped to HTTP responses by registered mappers.

The full request/response contract is in [`docs/API_CONTRACT.md`](docs/API_CONTRACT.md), and a live interactive spec is served by Swagger UI at `/docs`.

## Technologies

| Layer | Choice |
| --- | --- |
| Framework | NestJS 12, strict TypeScript 6, ESM (`"type": "module"`, `.js` import extensions) |
| ORM | Prisma Next v8 RC — contract-based client (`prisma/schema.prisma` → `contract.json`), hand-written singleton in `src/prisma/db.ts` |
| Database | PostgreSQL >= 15 |
| Auth | Passport + `passport-jwt`, `bcryptjs` password hashing, global `JwtAuthGuard` |
| Validation | `class-validator` / `class-transformer` via a global `ValidationPipe` (whitelist + transform) |
| API docs | `@nestjs/swagger` — Swagger UI at `/docs` |
| Tests | Vitest (unit `*.spec.ts` + e2e `*.e2e-spec.ts` with supertest) |
| Tooling | oxlint (linting), Prettier (formatting), dotenv (env loading) |

## Requirements

- Node.js >= 20
- PostgreSQL >= 15 with a reachable database

## Getting started

1. **Install dependencies:**

   ```bash
   npm install
   ```

2. **Configure the environment** — copy the example file and fill in your values:

   ```bash
   cp .env.example .env
   ```

   | Variable | Required | Default | Description |
   | --- | --- | --- | --- |
   | `DATABASE_URL` | Yes | — | PostgreSQL connection string (`postgresql://user:password@host:port/db`) |
   | `JWT_SECRET` | Yes | — | Secret used to sign JWTs; use a 64+ character random string |
   | `JWT_EXPIRES_IN` | No | `1d` | Access-token lifetime |
   | `PORT` | No | `3000` | HTTP port |

   `.env` is gitignored — never commit it.

3. **Start the dev server:**

   ```bash
   npm run start:dev
   ```

   The API listens on `http://localhost:3000` and Swagger UI is available at `http://localhost:3000/docs`.

## Scripts

| Command | What it does |
| --- | --- |
| `npm run start:dev` | Dev server with watch mode (`nest start --watch`) |
| `npm run build` | Production build — also the typecheck; deletes `dist` first |
| `npm run start:prod` | Run the built app (`node dist/main`) |
| `npm test` | Unit tests (`vitest run`, matches `*.spec.ts`) |
| `npm run test:e2e` | End-to-end tests (`vitest.config.e2e.ts`, matches `*.e2e-spec.ts`) — requires a reachable database |
| `npm run test:cov` | Tests with V8 coverage |
| `npm run lint` | Lint with oxlint (`oxlint src/ test/`) |
| `npm run format` | Format with Prettier |
| `npm run contract:emit` | Regenerate the Prisma contract after editing `prisma/schema.prisma` |

## Project structure

```
prisma/schema.prisma        Data contract (single source of truth)
migrations/                 Snapshot-style migrations (app/refs/db.json + snapshots)
src/
  main.ts                   Bootstrap: global ValidationPipe + Swagger + listen
  app.module.ts             Root module
  auth/                     Register/login/logout, JWT strategy, global guard, password hasher
  prisma/                   Contract-based client singleton + PrismaService
  error-handling/           GlobalExceptionFilter, AppException, error mappers, logger
  swagger/                  OpenAPI configuration (served at /docs)
test/                       E2E tests (*.e2e-spec.ts)
docs/                       API contract, error handling, testing, review standards
```

## API overview

Base operations (full details in [`docs/API_CONTRACT.md`](docs/API_CONTRACT.md)):

| Area | Endpoints | Auth |
| --- | --- | --- |
| Auth | `POST /auth/register`, `POST /auth/login`, `POST /auth/logout` | register/login public |
| Currencies | `GET /currencies` | JWT |
| Wallets | `GET /wallets`, `GET /wallets/:currencyCode` | JWT |
| Dashboard | `GET /dashboard` | JWT |

Every error response uses the same shape:

```json
{ "error": { "code": "VALIDATION_FAILED", "message": "email must be an email" } }
```

## Testing

- Unit tests live next to the code as `*.spec.ts` (`npm test`).
- E2E tests live in `test/` as `*.e2e-spec.ts` (`npm run test:e2e`) and bootstrap the real Nest app, so a reachable database is required.
- Conventions, pyramid ratios, and coverage targets are defined in [`docs/TEST.md`](docs/TEST.md).

## Documentation

- [`docs/API_CONTRACT.md`](docs/API_CONTRACT.md) — endpoints, request/response shapes, error codes
- [`docs/ERROR_HANDLING.md`](docs/ERROR_HANDLING.md) — error-handling system and exception class table
- [`docs/TEST.md`](docs/TEST.md) — testing conventions and coverage targets
- [`docs/CODE_REVIEW.md`](docs/CODE_REVIEW.md) — review checklist
- [`prisma-next.md`](prisma-next.md) — Prisma Next reference (this project does **not** use classic Prisma)

## License

UNLICENSED — private project, all rights reserved.
