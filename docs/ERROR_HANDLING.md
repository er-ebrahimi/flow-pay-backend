# Error Handling — Centralized System

FlowPay uses a centralized error-handling module located at `src/error-handling/`.
This is the **only sanctioned way** to raise, map, and respond to errors. Do not
throw raw `Error`, do not `@Catch` at the controller level, and do not hand-roll
`try/catch → res.status(...)` blocks in services.

Full module README (usage, OCP walkthrough, logger swap): `src/error-handling/README.md`.

## How it is mounted

`AppModule` imports `ErrorHandlingModule.forRoot()`, which registers
`GlobalExceptionFilter` as an `APP_FILTER`. Every uncaught exception anywhere in
the app is converted into one consistent response envelope:

```json
{ "error": { "code": "VALIDATION_FAILED", "message": "email must be an email" } }
```

## Rules for application code

1. **Throw domain exceptions, never bare `Error`s.**
   Use `src/error-handling/errors/domain.exceptions.ts`:

   | Class                   | Code                 | HTTP |
   |-------------------------|----------------------|------|
   | `NotFoundException`     | `NOT_FOUND`          | 404  |
   | `ValidationException`   | `VALIDATION_FAILED`  | 400  |
   | `UnauthorizedException` | `UNAUTHORIZED`       | 401  |
   | `ConflictException`     | `CONFLICT`           | 409  |
   | `InternalException`     | `INTERNAL_ERROR`      | 500  |

   Example:

   ```ts
   import { ConflictException } from '../error-handling/errors/domain.exceptions.js';

   throw new ConflictException('user already owns a USD wallet', { currencyCode: 'USD' });
   ```

2. **Need a status/code combo not in the list? Create a new domain exception**
   extending `AppException` and (if needed) a mapper class implementing
   `ErrorMapper`, then pass it via `ErrorHandlingModule.forRoot({ mappers: [YourMapper] })`.
   Never modify `GlobalExceptionFilter` to add a new case — that file is closed
   for modification, open for extension.

3. **Parametrize with `context`, not string concatenation.**

   ```ts
   // good
   throw new NotFoundException('wallet not found', { walletId: id });
   // bad
   throw new NotFoundException(`wallet ${id} not found`);
   ```

   `context` is a structured `Record<string, unknown>`; production responses
   strip it, and the logger still receives the full mapped object.

4. **Never leak internals.** Stack traces, driver errors, and query strings are
   handled by the filter: `DefaultMapper` collapses unknowns to a generic 500,
   and production responses omit `context`. Do not put secrets, tokens, or SQL
   into exception messages.

5. **ValidationPipe stays enabled at the app level.** Constraint violations from
   class-validator are auto-mapped by `ValidationPipeMapper` — you don't need to
   translate them manually in controllers.

## Architecture map

```
GlobalExceptionFilter (@Catch, APP_FILTER)
  ├── ERROR_MAPPERS (ordered array — first supports() wins)
  │     ├── [custom mappers from forRoot()]
  │     ├── AppExceptionMapper      → any AppException subclass
  │     ├── ValidationPipeMapper    → BadRequestException w/ class-validator payload
  │     ├── HttpExceptionMapper     → any Nest HttpException
  │     └── DefaultMapper           → catch-all, generic 500
  ├── ERROR_LOGGER (default NestErrorLoggerService, swap for Pino/Winston)
  └── route selection falls back to DefaultMapper if the array finds nothing
```

## Adding a new domain exception (the OCP proof)

1. Create the exception (extends `AppException`, distinct `code`/`httpStatus`).
2. Write a mapper in its feature folder implementing `ErrorMapper`.
3. Register the mapper via `ErrorHandlingModule.forRoot({ mappers: [YourMapper] })`.
4. Verify its unit tests for `supports()`/`toResponse()`.

No existing error-handling file requires edits for step 1–3 except the `forRoot`
invocation line in the module that imports it.
