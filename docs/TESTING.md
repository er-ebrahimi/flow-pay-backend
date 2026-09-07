# Testing Guide — FlowPay Backend

**Status:** Current (reflects the implemented suite)  
**Standards source:** `docs/TEST.md` (test pyramid, naming, mocking discipline). This document describes *what actually exists* in this repo, how to run it, and the supporting architecture.

---

## 1. How to run

```bash
npm test              # unit tests (Vitest, *.spec.ts) — no database needed
npm run test:cov      # unit tests + V8 coverage report
npm run test:e2e      # e2e tests (*.e2e-spec.ts) — runs against flowpay_test DB
npm run test:watch    # unit tests in watch mode
```

Both `npm test` and `npm run test:e2e` must pass before anything merges. Coverage:
- whole repo target ≥ 80% lines
- `src/auth` and everything touching money: ≥ 90% (TEST.md §7)

CI invariants: no `.skip()`, no `.only()`.

---

## 2. Current suite inventory

### Unit — `npm test` (8 files, 43 tests)

| File | Covers | Notes |
|---|---|---|
| `src/auth/auth.service.spec.ts` (5) | `AuthService` register/login | Mocked `PrismaDb` (inline fake capturing wallet creates + transaction), mocked hasher/JWT/config; verifies starter-wallet creation, unique-violation → `ConflictException`, login success/unknown-account/wrong-password with identical errors |
| `src/auth/ttl-in-seconds.spec.ts` (5 via `each`) | JWT TTL parser | `1d`/`2h`/`45m`/`30s`/`3600` + unparsable → null |
| `src/auth/guards/jwt-auth.guard.spec.ts` (2) | `@Public()` bypass | Real `Reflector` semantics: public handler passes, metadata-less rejects |
| `src/auth/hasher/bcrypt-password-hasher.spec.ts` (3) | Credential gate | Round-trip, wrong password rejected, same password salted differently both verify |
| `src/error-handling/errors/domain.exceptions.spec.ts` (5 via `each`) | 5 domain exceptions | code/httpStatus table + context attachment |
| `src/error-handling/filter/global-exception.filter.spec.ts` (7) | selection logic | first-supporting-mapper wins, custom-before-defaults, `DefaultMapper` fallback, throwing-mapper + throwing-logger resilience, prod/dev context exposure, log-before-respond ordering |
| `src/error-handling/mappers/mappers.spec.ts` (10) | all 4 mappers | `supports`/`toResponse` incl. discriminative cases (BadRequest-without-array-payload skips `ValidationPipeMapper`) |
| `src/error-handling/error-handling.module.spec.ts` (4) | `forRoot` options | mapper merge order, `APP_FILTER` registration, default logger, custom logger class swap, `IS_PRODUCTION` resolution |

### E2E — `npm run test:e2e` (2 files, 8 tests, real HTTP via Supertest)

| File | Covers |
|---|---|
| `test/auth.e2e-spec.ts` (6) | register 201 shape, duplicate 409 `CONFLICT`, invalid credentials 401 `UNAUTHORIZED` (both branches byte-identical), unauthenticated 401 on `POST /auth/logout` (the protected guard probe until wallet/dashboard endpoints exist), malformed payload 400 `VALIDATION_FAILED`, full journey (register → login → authorized `POST /auth/logout` → USD wallet balance `100.000000` asserted in DB) |
| `test/swagger.e2e-spec.ts` (2) | `/docs-json` serves bearer scheme + all auth paths + DTO constraints (`minLength/maxLength` on RegisterDto enforced by test); `/docs` serves the UI |

---

## 3. Architecture

### 3.1 The two runners and one decision

- **Unit** (`vitest.config.ts`): `*.spec.ts`, `globals: true`, no DB. Fast, isolated, the bulk of the pyramid (~70% target).
- **E2E** (`vitest.config.e2e.ts`): `*.e2e-spec.ts`, full `NestApplication` + Supertest. Never mocks DI internals; overrides nothing except what TEST.md §6 allows.

### 3.2 Test database isolation (`flowpay_test`)

E2E never touches the dev `flowpay` database. Three layers protect that:

1. **`.env.test`** (gitignored) carries `DATABASE_URL` pointing at `flowpay_test`.
2. **`vitest.config.e2e.ts`** loads `.env` first, then `.env.test` with `override: true` (so it wins over the `dotenv` call inside `src/prisma/db.ts`), then **refuses to run** unless the URL contains `flowpay_test`.
3. **`test/helpers/e2e-db.ts`** re-asserts the URL at module load (defense in depth), applies the schema idempotently (`npx prisma db update` — the project's snapshot-style migrations), truncates user data between specs with `TRUNCATE … CASCADE` (order doesn't matter, FK graph handles it), and reseeds the shared `currency` rows.

World-state contract: `currency` rows are **shared data** (restored by seed), user/wallet/transaction/quote/rate rows are **per-spec data** (wiped every `afterEach`).

```
npm run test:e2e
  └─ worker imports vitest.config.e2e.ts ── env loaded (flowpay_test enforced)
       └─ test/auth.e2e-spec.ts
            beforeAll → ensureSchemaApplied()  (prisma CLI, 120s hook budget)
            beforeEach → bootstrapApi()        (AppModule + same ValidationPipe as main.ts)
            afterEach  → resetDatabase()
            afterAll   → app.close()           (TEST.md §6.4 — no leaked Nest apps)
```

Hook timeouts are explicit (`beforeAll` 120s) because the prisma CLI spawn exceeds the 10s Vitest default on cold runs — the default timeout silently skips whole suites; see the comment in the spec.

### 3.3 Mocking discipline (TEST.md §8, applied)

- One shared inline pattern for the fake `PrismaDb` (see `auth.service.spec.ts`) — plain object with an inspectable `transaction`, not a mock library spelunking through `vi.mock()` magic.
- Third-party isolation: `PasswordHasher` is a port (`hasher/password-hasher.port.ts`) with `BcryptPasswordHasher` as the adapter — tests target the port in units and the adapter directly; a future argon2 swap only re-points the module provider.
- Services under test get their dependencies via `{ provide: X, useValue }` — no auto-mocker magic, no deep module mocking.

### 3.4 Error-envelope assertions

E2E always asserts **both** the HTTP status and the envelope code:

```ts
expect(second.status).toBe(409);
expect(second.body.error).toMatchObject({ code: 'CONFLICT' });
```

That pair is the project's API contract; a test asserting only the status would let the error body drift silently.

---

## 4. Known gaps (deliberate, revisit when the feature lands)

- `jwt.strategy.ts` is covered only via e2e (real token round-trip); a unit test would fake passport internals for little value. Its constructor covered at module init.
- `AuthService` lines 54 (raw error re-throw in `catch`) and 79 (logout return) are intentionally uncovered branches.
- No integration-tier suite yet (~20% of the pyramid per TEST.md) — the DB-touching register flow is e2e-tested for now. Reconsider a `*.spec.ts` integration suite with a containerized DB when the wallet/exchange modules arrive, per TEST.md §5.
- E2E requires the `flowpay_test` database to exist and the Prisma migration tree to be applied; `.env.test` is a documented manual step (copy the pattern from `.env.example` + a sibling DB). The suite fails loudly, never silently mutates the wrong DB.
