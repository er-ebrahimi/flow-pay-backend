import type { INestApplication } from '@nestjs/common';
import { ValidationPipe } from '@nestjs/common';
import type { TestingModule } from '@nestjs/testing';
import { Test } from '@nestjs/testing';
import { execSync } from 'node:child_process';
import pg from 'pg';

import { AppModule } from '../../src/app.module.js';
import { configureSwagger } from '../../src/swagger/configure-swagger.js';

const TEST_DB_URL = process.env['DATABASE_URL'] as string;

const SEED_CURRENCIES =
  'INSERT INTO "public"."currency" ("code", "name", "decimalPlaces") VALUES ' +
  "('USD','US Dollar',2),('EUR','Euro',2),('GBP','British Pound',2),('AED','UAE Dirham',2) " +
  'ON CONFLICT ("code") DO NOTHING';

function assertTestDatabase(url: string): void {
  if (!url.includes('flowpay_test')) {
    throw new Error(
      'Refusing e2e run: database URL must contain "flowpay_test" (got a different URL).',
    );
  }
}

assertTestDatabase(TEST_DB_URL);

/** Idempotent: creates the tables if missing, no-ops otherwise (prisma db update). */
export function ensureSchemaApplied(): void {
  execSync(`npx prisma db update --db "${TEST_DB_URL}"`, { stdio: 'pipe' });
}

let client: pg.Client | null = null;

async function clientFor(): Promise<pg.Client> {
  if (client === null) {
    client = new pg.Client({ connectionString: TEST_DB_URL });
    await client.connect();
  }
  return client;
}

/** Seeds an active USD→EUR / EUR→USD rate pair for the whole test window. */
export async function seedExchangeRates(): Promise<void> {
  const c = await clientFor();
  await c.query(
    `INSERT INTO "public"."exchangeRate" ("id","baseCurrency","quoteCurrency","rate","validFrom","validTo")
     VALUES
       (gen_random_uuid(), 'USD','EUR','0.8512', now() - interval '1 hour', now() + interval '1 hour'),
       (gen_random_uuid(), 'EUR','USD','1.1700', now() - interval '2 hour', now() + interval '2 hour')`,
  );
}

/**
 * Clears user-owned data between specs and restores the shared currency seed.
 * CASCADE handles the FK graph so truncation order never matters.
 */
export async function resetDatabase(): Promise<void> {
  const c = await clientFor();
  await c.query(
    'TRUNCATE "public"."user", "public"."wallet", "public"."transaction", ' +
      '"public"."exchangeQuote", "public"."exchangeRate" RESTART IDENTITY CASCADE',
  );
  await c.query(SEED_CURRENCIES);
}

export async function bootstrapApi(): Promise<INestApplication> {
  const moduleRef: TestingModule = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();
  const app = moduleRef.createNestApplication();
  // Mirrors main.ts so supertest sees the same validation and OpenAPI surface.
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      stopAtFirstError: true,
    }),
  );
  configureSwagger(app);
  await app.init();
  return app;
}
