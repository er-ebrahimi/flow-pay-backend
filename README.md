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

## User stories

| ID | As a | I want | So that |
| --- | --- | --- | --- |
| US-1 | new user | to register with an email and password | I get an account with a starter USD 100.00 wallet |
| US-2 | returning user | to log in and receive a bearer JWT | only I can move my money |
| US-3 | logged-in user | to log out | my client can discard the session token |
| US-4 | user | to list supported currencies with wallet counts | I know which currencies I can hold |
| US-5 | user | to see the currently active rate for a currency pair | I can time my exchange |
| US-6 | user | to request an exchange quote with fee and locked rate | I know the exact outcome before committing |
| US-7 | user | to confirm a quote using an `Idempotency-Key` header | a network retry never double-charges me |
| US-8 | user | to view my wallets with balances and transaction counts | I can track my money at a glance |
| US-9 | user | to see an aggregated dashboard of balances and activity | everything important is on one screen |

Key acceptance rules:

- Registration is atomic: user + starter wallet (`USD 100.00`) are created in a single transaction; a duplicate email returns `409 CONFLICT`.
- Login never reveals whether an email is registered — unknown email and wrong password return the same `401`.
- Quotes expire after 60 seconds; confirming an expired or already-consumed quote fails with a dedicated error code.
- Confirm is idempotent: first execution answers `201`, a replayed key answers `200`, both with the identical body; a key belonging to another user answers `409`.
- Wallet balances move under an optimistic `version` CAS with bounded retries, so concurrent confirms cannot double-spend.
- An unknown currency and an owned-but-missing wallet both return the same uniform `404` — wallet existence is never leaked.

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
   | `EXCHANGE_RATE_DEFAULT` | No | `1` | Default rate seeded for every currency pair by the default-rates migration; read once when that migration is attested, later edits do not reseed |

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

## Architecture

Controllers stay thin and delegate to services; services own the business rules, talk to PostgreSQL through `PrismaService`, and raise domain exceptions that the global filter renders into the uniform error envelope. `Money` keeps decimal arithmetic exact, and password hashing hides behind the `PasswordHasher` port so the algorithm is swappable.

```mermaid
classDiagram
    direction TB

    class AuthController {
        +register(dto)
        +login(dto)
        +logout()
    }
    class AuthService {
        +register(dto) AuthCommandResult
        +login(dto) LoginResult
        +logout()
    }
    class PasswordHasher {
        <<interface>>
        +hash(plain) Promise~string~
        +verify(plain, hash) Promise~boolean~
    }
    class BcryptPasswordHasher {
        +hash(plain) Promise~string~
        +verify(plain, hash) Promise~boolean~
    }
    class Public {
        <<annotation>>
    }
    class JwtAuthGuard {
        +canActivate(context)
    }

    class WalletsController
    class WalletsService {
        +findAllForUser(userId) Promise~WalletDto[]~
        +findByCode(userId, currencyCode) Promise~WalletDto~
    }
    class CurrenciesController
    class CurrenciesService {
        +findAll(query) Promise~CurrencyDto[]~
    }
    class RatesController
    class RatesService {
        +getActiveRate(base, quote) Promise~ActiveRate~
    }
    class QuotesController
    class QuotesService {
        +createQuote(userId, dto) Promise~ExchangeQuoteResponseDto~
    }
    class ExchangesController
    class ExchangeService {
        +confirm(userId, idempotencyKey, quoteId) Promise~TransactionResultDto~
    }
    class PrismaService {
        +db PrismaDb
    }
    class Money {
        +from(value, scale)$ Money
        +add(other) Money
        +subtract(other) Money
        +multiply(factor) Money
        +roundTo(scale) Money
        +isLessThan(other) boolean
        +toDecimalString() string
    }

    class AppException {
        <<abstract>>
        +code string
        +httpStatus number
        +context Record~string,unknown~
    }
    class NotFoundException
    class ValidationException
    class ConflictException
    class InsufficientFundsException
    class QuoteExpiredException
    class QuoteAlreadyConsumedException

    AuthController --> AuthService
    AuthService --> PasswordHasher : hasher port
    BcryptPasswordHasher ..|> PasswordHasher
    AuthService --> PrismaService
    WalletsController --> WalletsService
    CurrenciesController --> CurrenciesService
    RatesController --> RatesService
    QuotesController --> QuotesService
    ExchangesController --> ExchangeService
    WalletsService --> PrismaService
    CurrenciesService --> PrismaService
    RatesService --> PrismaService
    QuotesService --> PrismaService
    QuotesService --> RatesService : active rate
    QuotesService --> Money
    ExchangeService --> PrismaService
    ExchangeService --> Money
    JwtAuthGuard ..> Public : opt-out
    AppException <|-- NotFoundException
    AppException <|-- ValidationException
    AppException <|-- ConflictException
    AppException <|-- InsufficientFundsException
    AppException <|-- QuoteExpiredException
    AppException <|-- QuoteAlreadyConsumedException
```

## Data model

```mermaid
erDiagram
    USER ||--o{ WALLET : owns
    USER ||--o{ EXCHANGE_QUOTE : requests
    USER ||--o{ TRANSACTION : performs
    CURRENCY ||--o{ WALLET : denominates
    CURRENCY ||--o{ EXCHANGE_RATE : "quoted via"
    CURRENCY ||--o{ EXCHANGE_QUOTE : converts
    CURRENCY ||--o{ TRANSACTION : converts
    EXCHANGE_QUOTE |o--o| TRANSACTION : "consumed by"

    USER {
        uuid id PK
        string email UK
        string passwordHash
        timestamptz createdAt
    }
    CURRENCY {
        string code PK
        string name
        int decimalPlaces
    }
    WALLET {
        uuid id PK
        uuid userId FK
        string currencyCode FK
        numeric balance "Numeric(18,6)"
        int version "optimistic-lock CAS"
    }
    EXCHANGE_RATE {
        uuid id PK
        string baseCurrency FK
        string quoteCurrency FK
        numeric rate "Numeric(18,10)"
        timestamptz validFrom
        timestamptz validTo
    }
    EXCHANGE_QUOTE {
        uuid id PK
        uuid userId FK
        string fromCurrency FK
        string toCurrency FK
        numeric amount
        numeric fee
        numeric lockedRate
        timestamptz expiresAt
        timestamptz consumedAt
    }
    TRANSACTION {
        uuid id PK
        uuid userId FK
        uuid quoteId FK "nullable, unique"
        enum type "EXCHANGE"
        string fromCurrency FK
        string toCurrency FK
        numeric sourceAmount
        numeric fee
        numeric exchangeRate
        numeric destinationAmount
        enum status "PENDING | COMPLETED | FAILED"
        string idempotencyKey UK
        timestamptz createdAt
    }
```

The source of truth is [`prisma/schema.prisma`](prisma/schema.prisma) — regenerate the contract with `npm run contract:emit` after any change there.

## Default exchange rates

Every ordered pair of the supported currencies (USD, EUR, GBP, AED) has a seeded default rate, so `GET /exchange-rates`, exchange quotes, and dashboard totals work on a fresh database:

- Defaults are **1:1 parity** (`1.0000000000`), inserted by the `flowpay_default_exchange_rates` data migration. The value comes from `EXCHANGE_RATE_DEFAULT` (fallback `1`) and is read once when the migration is attested — editing `.env` afterwards does not change already-seeded rows.
- Defaults are valid 2000→9999 (always active) but carry the oldest `validFrom`, so any real rate inserted later **automatically supersedes** them: `RatesService.getActiveRate` picks the newest `validFrom` among active rows.
- Pairs of currencies with no rate row at all still return `404 NOT_FOUND` (see [`docs/API_CONTRACT.md`](docs/API_CONTRACT.md)).

## Database setup & seeding

```bash
npx prisma db update   # plans + applies contract operations (tables, indexes, FKs)
```

`prisma db update` plans **contract operations only** — it does not replay the raw-SQL data migrations under `migrations/app/`. For a fresh database, also execute the SQL in each data migration's `execute` block (currency seed + guardrail check constraints in `20260906T2115_flowpay_guardrails_seed`, default exchange rates in `20260908T1446_flowpay_default_exchange_rates`) via `psql` or a small `pg` script. Beware: because the guardrail check constraints are not part of the contract, a later `db update` may propose dropping them as "destructive operations" — never consent blindly.

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
