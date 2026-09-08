# Code Review Guide

This guide defines how developers and AI agents review changes in this NestJS backend project. It adapts Google's engineering practices to the backend architecture and rules documented for this repository.

## 1. Review standard

The goal is to improve the codebase's overall health: correctness, security, readability, maintainability, testability, performance, and consistency.

- Approve a change when it clearly improves code health and has no unresolved blocking issue. Do not demand perfection.
- Technical facts, project rules, tests, and measurable behavior take priority over personal preference.
- Keep each change focused on one self-contained purpose. Ask for unrelated refactors or generated changes to be split out.
- Review every changed, human-written line and enough surrounding code to understand its system impact.
- The author owns the implementation; the reviewer owns the quality of the approval.

## 2. Before requesting review

The author must:

- Provide a short summary of **what** changed and **why**.
- Describe API behavior, affected resources, authorization implications, migrations, risks, and important design decisions.
- Keep the change small; include related tests in the same change.
- Self-review the complete diff and remove debugging code, dead code, secrets, temporary code, and unrelated formatting.
- Run the relevant checks and state their results:

```sh
npm run lint
npm test -- --runInBand
npm run build
```

- Run relevant integration/E2E tests for changed critical API flows.
- If the change affects the database, run and verify the relevant migration and migration-related tests.
- If the change affects authentication or authorization, explicitly verify authenticated, unauthenticated, unauthorized, and permitted cases.

## 3. Review order

Review in this order so major issues are found before line-level polish:

1. **Intent and scope** — Does the change solve the stated problem? Is it focused and appropriate for this project?
2. **Main architecture** — Inspect the primary module, controller, service/use-case, repository/data-access flow, and external integrations first. If the design is wrong, report it before reviewing minor details.
3. **Correctness and risk** — Trace success, failure, validation, authorization, transactions, concurrency, idempotency, edge cases, and state transitions.
4. **NestJS and project rules** — Check module boundaries, dependency injection, DTOs, pipes, guards, interceptors, filters, configuration, database access, logging, and API conventions.
5. **Tests and verification** — Confirm tests are useful and would fail if the behavior broke. Run safe checks when possible.
6. **Every changed file** — Review the remaining implementation, tests, configuration, migrations, and documentation.
7. **Decision** — Approve, comment, or request changes using the severity rules below.

If the change is too large to understand confidently, ask the author to split it. If specialist review is needed for security, authorization, database integrity, infrastructure, or API compatibility, say so explicitly.

## 4. TypeScript and NestJS style guide — mandatory

Every changed `.ts` file must follow the project's TypeScript conventions and NestJS architectural conventions.

Apply rules in this order:

1. TypeScript and NestJS framework requirements.
2. Enforced or documented project conventions.
3. The project's general TypeScript style guide for everything not intentionally overridden above.

Known project/framework expectations:

- NestJS framework files such as modules, controllers, guards, pipes, interceptors, filters, decorators, and providers follow NestJS naming and export requirements.
- Files use the project's established naming convention. Do not introduce a second naming convention.
- Respect the project's path aliases and import boundaries.
- Keep dependency direction explicit. Shared infrastructure must not depend on business modules.
- Do not introduce circular module dependencies unless there is a documented architectural reason.

For each TypeScript/NestJS change, verify:

- Names are descriptive and use the correct casing: `PascalCase` for classes/types, `camelCase` for variables/functions/properties, and `UPPER_SNAKE_CASE` only for module-level constants where appropriate.
- Code uses ES modules, `const` by default, and `let` only for reassignment; it does not use `var`, `namespace`, or `require`.
- Modules minimize their exported API. Export only providers/controllers/types that other modules genuinely need.
- Types are specific and readable. Avoid `any`; prefer `unknown` plus narrowing at unsafe boundaries.
- Primitive wrapper types such as `String`, `Boolean`, and `Number` are not used.
- Type assertions (`as`), non-null assertions (`!`), double assertions, and compiler suppressions are not used merely to silence TypeScript. Any unavoidable unsafe boundary has a narrow scope and an explicit reason.
- DTOs define external input contracts. Do not use persistence entities/models as request DTOs merely for convenience.
- Request input is validated at the API boundary with the project's validation mechanism.
- Business rules are implemented in application/domain services, not in controllers.
- Controllers remain thin: parse/validate input, authorize the request, call the appropriate application service/use case, and map the result to the API response.
- Services do not depend on HTTP-specific objects unless there is a documented reason.
- Database access is isolated behind the project's repository/data-access boundary where the architecture requires it.
- External integrations are isolated behind dedicated providers/adapters instead of being scattered across business services.
- Configuration comes from the project's configuration system/environment validation rather than direct uncontrolled `process.env` access throughout the application.
- Production code contains no `debugger`, `eval`, dynamic `Function` construction, prototype modification, or `const enum`.
- Errors use the project's exception/error model. Do not expose stack traces, database errors, internal identifiers, secrets, or other sensitive details in API responses.
- Logging includes useful context without passwords, tokens, authorization headers, personal secrets, or sensitive payloads.
- JSDoc documents exported APIs when their purpose or usage is not obvious. Implementation comments explain **why**, not what the code already says.
- The code passes the project's formatter, ESLint rules, TypeScript checking, tests, and build. Tooling passing does not replace the semantic architecture review above.

## 5. Project checklist

Apply only the sections relevant to the change.

### API correctness and behavior

- Endpoint behavior matches the requirement and handles realistic edge cases.
- Request bodies, query parameters, path parameters, headers, and uploaded data are validated.
- Invalid input returns the project's expected validation/error response.
- Success responses use the project's established response shape and HTTP status conventions.
- Not-found, conflict, forbidden, unauthorized, validation, and internal-error cases are handled intentionally.
- User-facing/API error messages do not expose sensitive implementation details.
- Pagination, filtering, sorting, and limits are validated and bounded where applicable.
- API operations are idempotent where the business requirement requires idempotency.
- Timeouts, retries, and external-service failures are handled where relevant.

### NestJS architecture and ownership

- `src/` remains organized around clear application modules rather than becoming a global dumping ground.
- Each business capability belongs to an appropriate feature/module.
- Controllers contain transport/API concerns, not business logic.
- Business logic belongs in application/domain services or use-case providers.
- Modules define explicit `imports`, `providers`, `controllers`, and `exports`.
- Providers are exported only when another module genuinely needs them.
- Shared modules contain genuinely shared infrastructure/utilities and do not become business-logic dumping grounds.
- Cross-feature dependencies follow explicit module boundaries.
- Circular dependencies are avoided; `forwardRef()` is not used as a default solution to poor module design.
- Guards handle authorization/authentication concerns; pipes handle transformation/validation; interceptors handle cross-cutting request/response concerns; exception filters handle exception mapping.
- Middleware is used for appropriate request-level concerns rather than business logic.
- Controllers do not directly access the database when the project architecture defines a service/repository boundary.
- Background jobs/events/queues are isolated from synchronous HTTP handlers when applicable.
- Domain logic is not coupled unnecessarily to NestJS or HTTP-specific APIs.

### Authentication, authorization, and security

- Authentication is required on every protected endpoint.
- Authorization is checked at the correct resource/action boundary, not only at login.
- Guards/decorators/policies follow the project's authorization model.
- A user cannot access or mutate another user's resources by changing an ID in the request.
- Object-level authorization is verified for every relevant resource operation.
- Secrets, tokens, passwords, API keys, and credentials are never committed or logged.
- Passwords are never stored or returned in plaintext.
- Sensitive data is excluded from API responses unless explicitly required.
- Authentication tokens are validated for signature, expiry, issuer/audience where applicable, and required claims.
- Rate limiting, brute-force protection, payload limits, and abuse controls are applied where required.
- User-controlled data is handled safely against injection and unsafe dynamic queries.
- CORS, security headers, CSRF protection, and other transport/security controls follow the deployment architecture and project requirements.
- Error responses do not reveal whether sensitive resources exist when that information itself should remain private.

### Database and persistence

- Database schema changes are represented by versioned migrations according to the project convention.
- Migrations are safe, reviewable, and reversible when the project's migration system supports rollback.
- Existing data is considered before adding non-null columns, changing types, or adding constraints.
- Foreign keys and uniqueness constraints reflect actual business invariants.
- Indexes support important lookup, filtering, sorting, and uniqueness requirements without unnecessary duplication.
- Queries fetch only the required data and avoid accidental N+1 behavior.
- Transactions are used when multiple writes must succeed or fail atomically.
- Transaction boundaries match the business operation rather than being added indiscriminately.
- Concurrent updates are considered for counters, balances, inventory, state transitions, and other race-sensitive data.
- Soft deletion, archival, retention, and cascading behavior follow the project's domain requirements.
- Database errors are mapped to stable application/API errors rather than leaked directly to clients.
- Large datasets use bounded pagination/batching rather than unbounded reads.
- Seed/test data does not contain real secrets or sensitive production data.

### Business rules and state transitions

- Business invariants are enforced on the backend and are not trusted to the frontend.
- State transitions are explicit and valid.
- Invalid transitions are rejected.
- Operations are safe against duplicate requests where duplication could cause financial, data, or business harm.
- Side effects are performed only after required validation and authorization.
- External side effects are considered when transactions fail or requests are retried.
- Events/jobs are emitted only when the required state change has been successfully committed, unless the architecture intentionally uses another consistency model.
- Time, timezone, currency, precision, and rounding rules are explicit where relevant.

### External services and integrations

- External API calls have appropriate timeouts.
- Retry behavior is deliberate and does not duplicate non-idempotent operations.
- External failures are mapped to stable application errors.
- Credentials are loaded from secure configuration.
- External response data is validated before being trusted by business logic.
- Integration-specific code is isolated behind an adapter/provider boundary.
- Webhooks verify authenticity/signatures before processing.
- Webhook processing is idempotent where duplicate delivery is possible.
- Third-party outages do not unnecessarily crash unrelated application functionality.

### Performance and reliability

- No unnecessary database queries, repeated remote calls, or expensive synchronous operations.
- CPU- or memory-heavy work is moved out of request handlers when appropriate.
- Large request/response payloads are bounded.
- Caching is used only when invalidation and consistency are understood.
- Cache keys and TTLs are deliberate.
- Connection pools and resource lifecycles follow the project's configuration.
- Long-running tasks use queues/background workers where appropriate.
- Timeouts prevent indefinitely hanging requests.
- Graceful shutdown closes database connections, queues, and other resources.
- Health/readiness checks reflect the services required for the application to operate correctly.

### Tests and documentation

- Tests cover behavior and public outcomes, not implementation details.
- A changed test would fail if the production behavior were broken; assertions are specific and meaningful.
- Include success, error, validation, permission/authentication, authorization, transaction, retry, and edge cases when relevant.
- Use unit tests for local business logic and isolated providers.
- Use integration tests for database/repository behavior and important module interactions.
- Use E2E tests for critical API journeys across the HTTP/application/database layers.
- Tests are deterministic and isolated.
- Tests do not depend on real production services, credentials, or mutable external state unless explicitly designed as integration tests.
- API contracts, authorization behavior, persistence behavior, events/jobs, and external integrations are verified where relevant.
- Documentation is updated when API contracts, architecture, setup, database schema, migrations, or operational behavior changes.

## 6. Comment severity and decisions

| Label | Meaning | Blocks approval? |
| --- | --- | --- |
| **Blocker** | Security/privacy risk, data loss, broken authentication/authorization, destructive migration, build failure, crash, or severe production regression | Yes |
| **Required** | Correctness bug, violated project rule, invalid API contract, missing essential validation/test, data-integrity problem, or material maintainability issue | Yes |
| **Suggestion** | Valuable improvement that is not required for this change | No |
| **Nit** | Minor naming, wording, or formatting polish not enforced by project tooling | No |
| **Question** | Clarification needed; state explicitly whether the answer could become blocking | Not by itself |

Decision rules:

- **Request changes** when any Blocker or Required finding remains.
- **Approve with comments** when only Suggestions, Nits, or clearly non-blocking Questions remain.
- **Approve** when the change improves code health and verification is sufficient.
- Never block solely on a personal style preference. Let formatters, linters, TypeScript, tests, and documented conventions own mechanical style.

## 7. Writing useful comments

Comment on the code, not the author. Explain the consequence and the reason, then provide direction without unnecessarily designing the whole solution.

Use this format:

```text
[Required] `src/orders/orders.service.ts:42`

This update writes the order and creates the payment record in separate
transactions. A failure between the two operations can leave an order in a
state that does not have its required payment record.

Wrap the related writes in the project's transaction boundary, or document
why eventual consistency is intentional and how reconciliation is handled.
```

A useful finding contains:

- A severity label and precise file/line.
- The observable problem, not vague dislike.
- Why it matters: user impact, failure mode, security risk, data-integrity risk, or violated project rule.
- A practical direction or question.

Avoid:

- “This is bad,” “Why did you do this?”, or comments about the developer.
- Unsupported speculation and generic best-practice claims.
- Repeating formatter/linter output unless it blocks the change.
- Asking for unrelated cleanup. Record it separately when worthwhile.
- Leaving important explanations only in the review thread; improve the code or documentation for future readers.

## 8. AI reviewer contract

When an AI agent is asked to **review**, it must diagnose and report; it must not edit code unless explicitly asked to fix it.

The agent must:

1. Read the change description, diff, affected files, relevant tests, database migrations, and applicable project documents.
2. Use repository rules and evidence from the actual code. If documents conflict, do not guess: prefer machine-enforced/current code behavior and report the documentation mismatch.
3. Review only issues introduced or materially exposed by the change. Do not bury useful findings under unrelated legacy problems.
4. Trace callers, module dependencies, database consumers, and external integrations when needed to prove impact. Do not report a hypothetical issue without a realistic failure path.
5. Check tests as carefully as production code and run safe, relevant verification when available.
6. Report findings first, sorted by severity. Each finding must be actionable and cite a precise file/line.
7. State the final decision and any residual risk or unverified area. If there are no findings, say **“No blocking findings”** rather than inventing issues.

Required AI output:

```markdown
## Findings

1. [Required] `src/orders/orders.service.ts:42` — Short title

   Explain the failure, its impact, and the required direction.

## Decision

Approve | Approve with comments | Request changes

## Verification

- Checks run and results
- Checks not run and why

## Residual risks

- Unverified behavior, or “None identified”
```

## 9. Response time

Review at the next natural break in focused work. Give the first useful response within one business day. If a full review will take longer, quickly state when it can be completed or ask for a smaller change/another qualified reviewer.

## 10. Source documents

### Project rules

- `FILE_MANAGEMENT.md`
- `DATABASE.md`
- `API_DESIGN.md`
- `AUTHORIZATION.md`
- `TESTING.md`
- `ERROR_HANDLING.md`
- `CONFIGURATION.md`
- `rules.md`

### External foundation

- Google: The Standard of Code Review
- Google: What to Look For in a Code Review
- Google: Navigating a Change in Review
- Google: How to Write Code Review Comments
- Google: Small Changes
- Google: Writing Good Change Descriptions
- Google TypeScript Style Guide
- NestJS documentation and project-specific NestJS conventions
