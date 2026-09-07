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
```json
// 200
[ { "code": "USD", "name": "US Dollar", "decimalPlaces": 2 } ]
```
No error cases — always 200, empty array at worst.

---

## Wallets

### GET /wallets
```json
// 200
[ { "currencyCode": "USD", "balance": "10000.00", "transactionCount": 24 } ]
```

### GET /wallets/:currencyCode
```json
// 200
{ "currencyCode": "USD", "balance": "10000.00", "transactionCount": 24, "createdAt": "iso" }
```
| Case | Class | code | HTTP |
|---|---|---|---|
| No wallet for that currency, or currency doesn't exist | `NotFoundException` (`context: { currencyCode }`) | `NOT_FOUND` | 404 |

---

## Dashboard

### GET /dashboard
```json
// 200
{
  "totalBalanceBase": "18542.72",
  "baseCurrency": "USD",
  "wallets": [ { "currencyCode": "USD", "balance": "10000.00" } ],
  "recentTransactions": [ /* GET /transactions item shape, capped at 5 */ ]
}
```
No error cases beyond auth.

---

## Exchange rates

### GET /exchange-rates?base=USD&quote=EUR
```json
// 200
{ "base": "USD", "quote": "EUR", "rate": "0.8512", "asOf": "iso" }
```
| Case | Class | code | HTTP |
|---|---|---|---|
| Missing/invalid query params | `ValidationException` | `VALIDATION_FAILED` | 400 |
| No active rate for the pair | `NotFoundException` (`context: { base, quote }`) | `NOT_FOUND` | 404 |

Read-only — powers the live rate display while typing. Locks nothing.

---

## Exchange (two-step: quote, then confirm)

### POST /exchange-quotes
```json
// Request
{ "fromCurrency": "USD", "toCurrency": "EUR", "amount": "1000.00" }

// 201
{
  "quoteId": "uuid", "fromCurrency": "USD", "toCurrency": "EUR",
  "amount": "1000.00", "fee": "7.50", "rate": "0.8512",
  "destinationAmount": "844.84", "expiresAt": "iso"
}
```
| Case | Class | code | HTTP |
|---|---|---|---|
| `fromCurrency == toCurrency` | `ValidationException` (`context: { reason: 'SAME_CURRENCY' }`) | `VALIDATION_FAILED` | 400 |
| Zero/negative/wrong-precision amount | `ValidationException` (`context: { reason: 'INVALID_AMOUNT' }`) | `VALIDATION_FAILED` | 400 |
| Not enough funds (pre-check) | `InsufficientFundsException` *(new)* | `INSUFFICIENT_BALANCE` | 422 |

`InsufficientFundsException` extends `AppException` — 422 and this exact code aren't in the base table (which tops out at 409/500), and the frontend needs to branch on this specific code to show "Insufficient X balance" and keep the user on the amount field, per the UX spec. Reusing `ValidationException` would lose that distinction, so this earns its own class rather than an overload of `VALIDATION_FAILED`. No new mapper needed — `AppExceptionMapper` already reads `code`/`httpStatus` off any `AppException` subclass.

### POST /exchanges
Requires header: `Idempotency-Key: <client-generated-uuid>`
```json
// Request
{ "quoteId": "uuid" }

// 201 (or 200 if idempotency key already seen — same body, not re-executed)
{
  "transactionId": "TXN-000001", "status": "COMPLETED",
  "fromCurrency": "USD", "toCurrency": "EUR",
  "sourceAmount": "1000.00", "fee": "7.50", "rate": "0.8512",
  "destinationAmount": "844.84", "createdAt": "iso"
}
```
| Case | Class | code | HTTP |
|---|---|---|---|
| `quoteId` doesn't exist | `NotFoundException` | `NOT_FOUND` | 404 |
| Quote's `expiresAt` has passed | `QuoteExpiredException` *(new)* | `QUOTE_EXPIRED` | 410 |
| Quote already has `consumed_at` set | `QuoteAlreadyConsumedException` *(new)* | `QUOTE_ALREADY_CONSUMED` | 409 |
| Balance re-check fails inside the DB transaction | `InsufficientFundsException` | `INSUFFICIENT_BALANCE` | 422 |

`QuoteExpiredException` needs 410, which isn't in the base table at all — new class, no way around it. `QuoteAlreadyConsumedException` could technically reuse `ConflictException`/`CONFLICT`, but that would make "someone reused a stale quote" and "you tried to register a taken email" indistinguishable to the client at the code level — different recovery action (refresh the quote vs. pick another email), so it gets its own code at the same 409 status. Both are plain `AppException` subclasses, no filter changes.

---

## Transactions

### GET /transactions
Query: `page`, `limit` (default 20), `type`, `status`, `currency`, `dateFrom`, `dateTo`, `search`
```json
// 200
{
  "items": [ { "id": "TXN-000001", "type": "EXCHANGE", "fromCurrency": "USD",
    "toCurrency": "EUR", "sourceAmount": "1000.00", "destinationAmount": "844.84",
    "status": "COMPLETED", "createdAt": "iso" } ],
  "page": 1, "limit": 20, "total": 137
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