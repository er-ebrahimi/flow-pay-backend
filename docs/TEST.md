# NestJS Testing Standards

Sourced from the [official NestJS testing docs](https://docs.nestjs.com/fundamentals/testing) + Google's test-pyramid philosophy (small/medium/large), the industry standard most FAANG-style orgs actually follow. Because untested code is just a bug you haven't met yet.

---

## 1. Test Pyramid (the ratio that matters)

| Google term | Common term | % of suite | Speed | Scope |
|---|---|---|---|---|
| Small | Unit | ~70% | ms | Single class/function, no I/O, no network |
| Medium | Integration | ~20% | ms–sec | Module + real DI graph, mocked external deps |
| Large | E2E | ~10% | sec | Full app boot, real HTTP layer via Supertest |

Rule of thumb: if you're writing more E2E tests than unit tests, you're doing it backwards — slow, flaky, and expensive to maintain.

---

## 2. Tooling

- **Test runner**: Vitest (new Nest projects default to Vitest)
- **HTTP simulation**: Supertest (`request(app.getHttpServer())`)
- **DI/testing utilities**: `@nestjs/testing` → `Test.createTestingModule()`
- Install: `npm i --save-dev @nestjs/testing`

---

## 3. File & Naming Conventions

- Unit tests: live **next to** the file they test → `cats.service.spec.ts`
- E2E tests: live in the top-level `test/` directory → `cats.e2e-spec.ts`
- Suffix rules are non-negotiable: `.spec.ts` (unit/integration) / `.e2e-spec.ts` (e2e)
- One `describe()` block per class/controller, nested `describe()` per method

---

## 4. Unit Testing Rules

1. **Isolate the unit.** No real DB, no real HTTP, no filesystem. Mock every collaborator.
2. Use `Test.createTestingModule({ providers, controllers }).compile()` to get Nest's DI benefits (don't hand-instantiate classes unless the test is trivially framework-agnostic).
3. Follow **Arrange-Act-Assert (AAA)**:
   ```ts
   it('should return an array of cats', async () => {
     // Arrange
     const result = ['test'];
     vi.spyOn(catsService, 'findAll').mockResolvedValue(result);
     // Act
     const response = await catsController.findAll();
     // Assert
     expect(response).toBe(result);
   });
   ```
4. Use `useMocker()` for auto-mocking when a class has many dependencies — don't hand-roll 10 mock providers.
5. `REQUEST` and `INQUIRER` providers can't be auto-mocked — override them explicitly if needed.
6. One assertion concept per test. If your test name has "and" in it, split it.
7. Test behavior, not implementation. Don't assert on private internals.

---

## 5. Integration Testing Rules

1. Boot a real module (`imports: [SomeModule]`) but override the *boundary* dependencies (DB clients, external APIs) with `.overrideProvider().useValue()`.
2. Use this layer to verify wiring: does the controller actually call the right service, does the module resolve its providers correctly.
3. Don't hit a live database. Use an in-memory/test double or a Testcontainers-backed ephemeral instance if the module truly requires real persistence behavior — never a shared dev DB.

---

## 6. E2E Testing Rules

1. Spin up the full app: `moduleRef.createNestApplication()` → `app.init()`.
2. Simulate real requests through Supertest: `request(app.getHttpServer()).get('/cats')`.
3. Override only what you must (e.g. swap a real payment gateway for a stub) — the point of E2E is to test the real wiring, not to mock everything into a unit test wearing a costume.
4. Always `await app.close()` in `afterAll()` — leaking Nest app instances between test files causes port/handle leaks and flaky CI.
5. For globally-registered guards/pipes/interceptors (`APP_GUARD`, etc.), register them with `useExisting` (not `useClass`) so they're overridable in tests.
6. Cover critical user journeys (auth flow, create→update→delete), not every possible permutation — that's what unit tests are for.

---

## 7. Coverage

- Target **80%+** line coverage as the "good" bar, 90%+ for critical modules (auth, payments, anything touching money or PII).
- Never chase 100% by excluding files from the coverage config — that's lying to your future self.
- Check coverage gaps with `npm run test:cov` and prioritize untested branches, not just untested lines.

---

## 8. Mocking Discipline

- Prefer `useValue`/`useFactory` overrides over deep jest.mock() magic — keeps tests readable.
- Don't mock what you don't own carelessly (3rd-party SDKs) — wrap them in your own provider/interface first, then mock the wrapper.
- Reusable mock factories go in a shared `test/mocks/` or `__mocks__/` folder — don't copy-paste the same `CatsService` stub into 15 spec files.

---

## 9. CI Requirements

```json
"scripts": {
  "test": "jest",
  "test:watch": "jest --watch",
  "test:cov": "jest --coverage",
  "test:e2e": "jest --config ./test/jest-e2e.json"
}
```
- `test` (unit) + `test:e2e` must both pass before merge.
- Coverage report is a required CI artifact, not optional.
- No skipped/`.only()` tests allowed to merge — that's how a "temporary" skip lives in prod for two years.

---

## References

- Official docs: https://docs.nestjs.com/fundamentals/testing
- Google Testing Blog — Test Sizes: https://testing.googleblog.com/2010/12/test-sizes.html
- "Software Engineering at Google" — Ch. 11–14 (Testing Overview, Unit Testing, Test Doubles, Larger Testing): https://abseil.io/resources/swe-book/html/ch14.html