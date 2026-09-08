# FlowPay API Contract

Base URL: `/api`
Auth: `Authorization: Bearer <jwt>` on all routes except `/auth/*`

Error shape (always — from `GlobalExceptionFilter`):
```json
{ "error": { "code": "VALIDATION_FAILED", "message": "email must be an email" } }
```
`context` is included in non-production responses only, per `src/error-handling`.

---

## Auth

### POST /auth/register
```json
// Request
{ "email": "user@example.com", "password": "min 8 chars" }

// 201
{ "id": "uuid", "email": "user@example.com", "createdAt": "iso" }
```
| Case | Class | code | HTTP |
|---|---|---|---|
| DTO shape invalid | `ValidationPipeMapper` (auto) | `VALIDATION_FAILED` | 400 |
| Email already registered | `ConflictException` | `CONFLICT` | 409 |

### POST /auth/login
```json
// Request
{ "email": "user@example.com", "password": "..." }

// 200
{ "accessToken": "jwt", "expiresIn": 3600 }
```
| Case | Class | code | HTTP |
|---|---|---|---|
| Bad email/password | `UnauthorizedException` | `UNAUTHORIZED` | 401 |

### POST /auth/logout
`204`, no body.

---

## Currencies

### GET /currencies
Optional query: `?exclude=<CODE>` — drops that currency from the response
(backend-side filtering for the exchange dialog). A well-formed but unknown
code silently filters nothing.

```json
// 200
[
  {
    "code": "USD", "name": "US Dollar", "decimalPlaces": 2, "walletCount": 4
  }
]
```
`walletCount` is a global statistic (number of wallets holding the currency, across all
users) — not user-scoped, no PII. Rows are sorted by `code` ascending.

| Case | Class | code | HTTP |
|---|---|---|---|
| `exclude` present but not 3 uppercase letters | `ValidationPipeMapper` (auto) | `VALIDATION_FAILED` | 400 |
| Missing auth token | `JwtAuthGuard` (auto) | `UNAUTHORIZED` | 401 |

---

## Wallets

All reads are scoped to the authenticated user — another user's wallets are never
visible, and an unknown currency code produces the exact same 404 as a missing
wallet (no existence leak).

### GET /wallets
```json
// 200
[
  { "currencyCode": "USD", "balance": "10000.00", "transactionCount": 24 }
]
```
- `balance` is display-ready: the DB numeric string rendered at the currency
  `decimalPlaces` precision, rounded half-up on the magnitude (never truncating
  tail digits — a balance must not silently lose money).
- `transactionCount` counts transactions where the currency is the **source or
  the destination** — the same cut `GET /transactions?currency=...` uses later.
Rows are sorted by `currencyCode` ascending.

### GET /wallets/:currencyCode
```json
// 200
{ "currencyCode": "USD", "balance": "10000.00", "transactionCount": 24, "createdAt": "iso" }
```
| Case | Class | code | HTTP |
|---|---|---|---|
| Route param not 3 uppercase letters | `ValidationPipeMapper` (auto) | `VALIDATION_FAILED` | 400 |
| No wallet for that currency, or currency doesn't exist (identical body — don't leak existence) | `NotFoundException` (`context: { currencyCode }`, non-prod only) | `NOT_FOUND` | 404 |
| Missing auth token | `JwtAuthGuard` (auto) | `UNAUTHORIZED` | 401 |

---

## Dashboard

### GET /dashboard
```json
// 200
{
  "totalBalanceBase": "99.42",
  "baseCurrency": "USD",
  "wallets": [
    { "currencyCode": "USD", "balance": "50.00" },
    { "currencyCode": "EUR", "balance": "42.24" }
  ],
  "recentTransactions": [ /* GET /transactions item shape, capped at 5 */ ]
}
```
- `baseCurrency` is fixed **USD**.
- Conversion uses the active `<currency> → USD` rate, exact Money math
  rounded half-up at 2 places. The user's own USD wallet counts at face value.
- **Wallets without an active rate to USD are excluded from `totalBalanceBase`**
  (documented rule — inventing a rate would overstate the user's money while
  the wallet list still shows the row).
- Exchanges performed by the user appear in `recentTransactions` (newest first).
| Case | Class | code | HTTP |
|---|---|---|---|
| Missing auth token | `JwtAuthGuard` (auto) | `UNAUTHORIZED` | 401 |

---

## Exchange rates

### GET /exchange-rates?base=USD&quote=EUR
```json
// 200
{ "base": "USD", "quote": "EUR", "rate": "0.8512", "asOf": "iso" }
```
- **Active row rule**: `validFrom <= now < validTo`; when several rows overlap,
  the newest `validFrom` wins. Neither endpoint dates rows forever: no active
  row → 404.
- **Seeded defaults**: the `flowpay_default_exchange_rates` migration inserts an
  always-active 1:1 default row (valid 2000→9999, value from
  `EXCHANGE_RATE_DEFAULT` at migration-attest time) for every ordered pair of
  the seeded currencies (USD/EUR/GBP/AED). Because defaults carry the oldest
  `validFrom`, any real rate added later supersedes them automatically.
- `base == quote` is a user error even though both codes are well-formed.
| Case | Class | code | HTTP |
|---|---|---|---|
| Missing/invalid query params, or `base` == `quote` | `ValidationPipeMapper` / `ValidationException` (`context.reason = 'SAME_CURRENCY'`) | `VALIDATION_FAILED` | 400 |
| No active rate for the pair (non-seeded currencies) | `NotFoundException` (`context: { base, quote }`) | `NOT_FOUND` | 404 |

Read-only — powers the live rate display while typing. Locks nothing.

---

## Exchange (two-step: quote, then confirm)

**Canonical exchange math** (implemented, half-up everywhere in exact
BigInt arithmetic):

- `fee = round(amount × 0.75% , fromCurrency.decimalPlaces)` — charged in the
  source currency (`EXCHANGE_FEE_PCT` env overrides the rate)
- `destinationAmount = round((amount − fee) × lockedRate, toCurrency.decimalPlaces)`

*(The example figures below predate the formula's introduction and were never
self-consistent; the formula above is the source of truth — e.g. 100.00 USD →
EUR: fee 0.75, destination 99.25 × 0.8512 = 84.48.)*

### POST /exchange-quotes
```json
// Request
{ "fromCurrency": "USD", "toCurrency": "EUR", "amount": "100.00" }

// 201 (id of the created quote is a uuid)
{
  "quoteId": "db4180cc-…", "fromCurrency": "USD", "toCurrency": "EUR",
  "amount": "100.00", "fee": "0.75", "rate": "0.8512",
  "destinationAmount": "84.48", "expiresAt": "iso"
}
```
| Case | Class | code | HTTP |
|---|---|---|---|
| `fromCurrency == toCurrency` | `ValidationException` (`context: { reason: 'SAME_CURRENCY' }`) | `VALIDATION_FAILED` | 400 |
| Zero/negative/wrong-precision amount vs `fromCurrency.decimalPlaces` | `ValidationException` (`context: { reason: 'INVALID_AMOUNT' }`) | `VALIDATION_FAILED` | 400 |
| Unknown `fromCurrency`/`toCurrency` | `NotFoundException` | `NOT_FOUND` | 404 |
| No wallet in the source currency | `InsufficientFundsException` | `INSUFFICIENT_BALANCE` | 422 |
| Not enough funds (pre-check) | `InsufficientFundsException` | `INSUFFICIENT_BALANCE` | 422 |

`InsufficientFundsException` extends `AppException` — 422 and this exact code aren't in the base table (which tops out at 409/500), and the frontend needs to branch on this specific code to show "Insufficient X balance" and keep the user on the amount field, per the UX spec. Reusing `ValidationException` would lose that distinction, so this earns its own class rather than an overload of `VALIDATION_FAILED`. No new mapper needed — `AppExceptionMapper` already reads `code`/`httpStatus` off any `AppException` subclass.

### POST /exchanges
Requires header: `Idempotency-Key: <client-generated-uuid>`. Missing or
malformed → 400. A key seen **by the same user** replays the original result
with **200** (identical body, zero re-execution); the same key used by a
**different user** is a hard **409 `CONFLICT`** — the idempotency column is
globally unique, so this is a real constraint collision and a leak guard.
```json
// Request
{ "quoteId": "uuid" }

// 201 on first execution (200 on same-user replay — same body, not re-executed)
{
  "transactionId": "uuid", "status": "COMPLETED",
  "fromCurrency": "USD", "toCurrency": "EUR",
  "sourceAmount": "50.00", "fee": "0.38", "rate": "0.8512",
  "destinationAmount": "42.24", "createdAt": "iso"
}
```
Inside one DB transaction: fresh quote read (expiry + consumption re-check),
source debit and destination credit with a `version` CAS (ERD's `version`
exists exactly for this — lost races fail with `INSUFFICIENT_BALANCE` on the
source or `QUOTE_ALREADY_CONSUMED` on the quote), then the transaction row is
inserted with the frozen values. A currency the user never held is collected
into a new wallet created inside the same transaction.

| Case | Class | code | HTTP |
|---|---|---|---|
| `Idempotency-Key` missing/malformed | `ValidationException` | `VALIDATION_FAILED` | 400 |
| `quoteId` unknown, **or belongs to another user** (identical body — don't leak) | `NotFoundException` | `NOT_FOUND` | 404 |
| Quote's `expiresAt` has passed | `QuoteExpiredException` | `QUOTE_EXPIRED` | 410 |
| Quote already consumed (by this user or a concurrent confirm winner) | `QuoteAlreadyConsumedException` | `QUOTE_ALREADY_CONSUMED` | 409 |
| Balance re-check fails inside the DB transaction | `InsufficientFundsException` | `INSUFFICIENT_BALANCE` | 422 |
| Idempotency key already used by another user | `ConflictException` | `CONFLICT` | 409 |

`QuoteExpiredException` needs 410, which isn't in the base table at all — new class, no way around it. `QuoteAlreadyConsumedException` could technically reuse `ConflictException`/`CONFLICT`, but that would make "someone reused a stale quote" and "you tried to register a taken email" indistinguishable to the client at the code level — different recovery action (refresh the quote vs. pick another email), so it gets its own code at the same 409 status. Both are plain `AppException` subclasses, no filter changes.

---

## Transactions

### GET /transactions
Query: `page`, `limit` (default 20, **hard-clamped to 100**; malformed values
are a 400, not silent clamping — only values above the cap are clamped),
`type`, `status`, `currency` (matches the source OR destination side),
`dateFrom`/`dateTo` (ISO 8601; malformed → 400), `search` (id-prefix only —
users cannot name-fish other ids)
```json
// 200
{
  "items": [ { "id": "uuid", "type": "EXCHANGE", "fromCurrency": "USD",
    "toCurrency": "EUR", "sourceAmount": "50.00", "destinationAmount": "42.24",
    "status": "COMPLETED", "createdAt": "iso" } ],
  "page": 1, "limit": 20, "total": 1
}
```
`items: []` is the empty state — not an error.

### GET /transactions/:id
```json
// 200
{ "id": "TXN-000001", "type": "EXCHANGE", "fromCurrency": "USD", "toCurrency": "EUR",
  "sourceAmount": "1000.00", "fee": "7.50", "rate": "0.8512",
  "destinationAmount": "844.84", "status": "COMPLETED", "createdAt": "iso" }
```
| Case | Class | code | HTTP |
|---|---|---|---|
| Not found, or belongs to another user (don't leak existence — same response either way) | `NotFoundException` | `NOT_FOUND` | 404 |

---

## Error code reference (final)

| code | HTTP | Source |
|---|---|---|
| `VALIDATION_FAILED` | 400 | Base table — DTO validation + `SAME_CURRENCY`/`INVALID_AMOUNT` via context |
| `UNAUTHORIZED` | 401 | Base table |
| `NOT_FOUND` | 404 | Base table — wallet/rate/quote/transaction, resource named in context |
| `CONFLICT` | 409 | Base table — duplicate email |
| `INSUFFICIENT_BALANCE` | 422 | New — `InsufficientFundsException` |
| `QUOTE_EXPIRED` | 410 | New — `QuoteExpiredException` |
| `QUOTE_ALREADY_CONSUMED` | 409 | New — `QuoteAlreadyConsumedException` |
| `INTERNAL_ERROR` | 500 | Base table — `DefaultMapper` catch-all |

**Note:** `CONFLICT` now has two producers: duplicate email (registration) and
an idempotency key crossing users. Both are 409 with distinct messages.

## Edge cases implemented
1. **Double-submit / network retry** → `Idempotency-Key` replay: same-user 200 replay; cross-user 409
2. **Concurrent exchanges draining the same wallet** → `version` CAS with a bounded retry loop; lost races surface as `INSUFFICIENT_BALANCE`/`QUOTE_ALREADY_CONSUMED`
3. **Rate expires between quote and confirm** → locked `lockedRate` on the quote; confirm re-checks `expiresAt` (410) and consumption (409)
4. **Same-currency exchange** → rejected at validation (`SAME_CURRENCY`), plus guardrail CHECK constraints in the DB
5. **Partial failure mid-exchange** → everything inside one `db.transaction` (debit+credit+consume+i nsert)
6. **Currency-specific decimal places** → no hardcoded scale: fees/amounts round at each currency's `decimalPlaces` through the `Money` value object
7. **Negative/zero/garbage amount** → DTO regex + `Money` parse + scale check (`INVALID_AMOUNT`)
8. **Wallet for a new currency** → auto-created on first exchange (config: registration pre-provisions USD only, with a 100.00 starter balance)
9. **Rounding order** → fee first at source scale, then convert the net remainder (documented above)
10. **No active rate pair** → quotes 404 at creation rather than locking `null`; dashboard excludes such wallets instead of trusting a stale number
11. **Transaction list pagination** → `limit` clamped to 100; malformed filters are explicit 400s, never silent reinterpretation
12. **Existence leaks** → wallet detail, transaction detail, and confirm-quote reads all return the identical 404 for missing vs foreign-owned resources
