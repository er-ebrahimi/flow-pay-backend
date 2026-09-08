import request from 'supertest';
import type { INestApplication } from '@nestjs/common';
import pg from 'pg';

import { bootstrapApi, ensureSchemaApplied, resetDatabase } from './helpers/e2e-db.js';

describe('Exchange rates (e2e)', () => {
  let app: INestApplication;
  let dbClient: pg.Client;

  beforeAll(async () => {
    ensureSchemaApplied();
    app = await bootstrapApi();
    dbClient = new pg.Client({ connectionString: process.env['DATABASE_URL'] });
    await dbClient.connect();
    await seedRates(dbClient!);
  }, 120_000);

  afterEach(async () => {
    // The shared reset also truncates exchange rates, so the pair's active
    // rate is re-seeded after each spec.
    await resetDatabase();
    await seedRates(dbClient!);
  }, 30_000);

  afterAll(async () => {
    await app.close();
    await dbClient.end();
  }, 60_000);

  it('holds unauthenticated requests at the global guard', async () => {
    const noToken = await request(app.getHttpServer()).get('/exchange-rates?base=USD&quote=EUR');
    expect(noToken.status).toBe(401);
    expect(noToken.body.error).toMatchObject({ code: 'UNAUTHORIZED' });
  });

  it('rejects same-currency inquiries with the validation envelope', async () => {
    const token = await registerAndLogin(app);
    const response = await request(app.getHttpServer())
      .get('/exchange-rates')
      .set('Authorization', `Bearer ${token}`)
      .query('base=USD')
      .query('quote=USD')
      .expect(400);

    expect(response.body.error).toMatchObject({ code: 'VALIDATION_FAILED' });
    expect(response.body.error.message).toContain('differ');
  });

  it('returns the active rate with its asOf stamp', async () => {
    const token = await registerAndLogin(app);

    const response = await request(app.getHttpServer())
      .get('/exchange-rates')
      .set('Authorization', `Bearer ${token}`)
      .query('base=USD')
      .query('quote=EUR')
      .expect(200);

    expect(response.body).toEqual({
      base: 'USD',
      quote: 'EUR',
      rate: '0.8512',
      asOf: expect.any(String),
    });
  });

  it('404s with NOT_FOUND when the pair has no active rate', async () => {
    const token = await registerAndLogin(app);

    const response = await request(app.getHttpServer())
      .get('/exchange-rates')
      .set('Authorization', `Bearer ${token}`)
      .query('base=GBP')
      .query('quote=EUR')
      .expect(404);

    expect(response.body.error).toMatchObject({ code: 'NOT_FOUND', context: { base: 'GBP', quote: 'EUR' } });
  });

  it('rejects malformed rate query params with validation failure', async () => {
    const token = await registerAndLogin(app);

    const response = await request(app.getHttpServer())
      .get('/exchange-rates')
      .set('Authorization', `Bearer ${token}`)
      .query('base=usd')
      .query('quote=EUR')
      .expect(400);

    expect(response.body.error).toMatchObject({ code: 'VALIDATION_FAILED' });
  });

  it('rejects a malformed rate body with the validation envelope', async () => {
    const token = await registerAndLogin(app);

    const response = await request(app.getHttpServer())
      .post('/exchange-rates')
      .set('Authorization', `Bearer ${token}`)
      .send({ base: 'usd', quote: 'EUR', rate: '0.86', validFrom: 'not-a-date', validTo: '9999-12-31T00:00:00Z' })
      .expect(400);

    expect(response.body.error).toMatchObject({ code: 'VALIDATION_FAILED' });
  });

  it('rejects same-currency rate creation', async () => {
    const token = await registerAndLogin(app);

    const response = await request(app.getHttpServer())
      .post('/exchange-rates')
      .set('Authorization', `Bearer ${token}`)
      .send({ base: 'USD', quote: 'USD', rate: '1', validFrom: '2026-09-08T00:00:00Z', validTo: '9999-12-31T00:00:00Z' })
      .expect(400);

    expect(response.body.error).toMatchObject({ code: 'VALIDATION_FAILED' });
  });

  it('creates a rate row that becomes the active rate', async () => {
    const token = await registerAndLogin(app);
    // validFrom = now is newer than the seeded defaults (now() - 1 hour), so
    // the new row wins under newest-validFrom-wins resolution.
    const validFrom = new Date().toISOString();

    const setResponse = await request(app.getHttpServer())
      .post('/exchange-rates')
      .set('Authorization', `Bearer ${token}`)
      .send({ base: 'USD', quote: 'EUR', rate: '0.8612', validFrom, validTo: '9999-12-31T00:00:00Z' })
      .expect(201);

    expect(setResponse.body).toMatchObject({
      base: 'USD',
      quote: 'EUR',
      rate: '0.8612',
    });

    // The new row supersedes the older seeded rate because its validFrom is newer.
    const getResponse = await request(app.getHttpServer())
      .get('/exchange-rates')
      .set('Authorization', `Bearer ${token}`)
      .query('base=USD')
      .query('quote=EUR')
      .expect(200);

    expect(getResponse.body).toMatchObject({ base: 'USD', quote: 'EUR', rate: '0.8612' });
  });
});

async function seedRates(client: pg.Client): Promise<void> {
  await client.query(
    `INSERT INTO "public"."exchangeRate" ("id","baseCurrency","quoteCurrency","rate","validFrom","validTo")
     VALUES
       (gen_random_uuid(), 'USD','EUR','0.8512', now() - interval '1 hour', now() + interval '1 hour'),
       (gen_random_uuid(), 'EUR','USD','1.1700', now() - interval '2 hour', now() + interval '2 hour')`,
  );
}

async function registerAndLogin(app: INestApplication): Promise<string> {
  const email = `rate-${crypto.randomUUID()}@example.com`;
  await request(app.getHttpServer())
    .post('/auth/register')
    .send({ email, password: 'hunter2hunter2' })
    .expect(201);
  const login = await request(app.getHttpServer())
    .post('/auth/login')
    .send({ email, password: 'hunter2hunter2' })
    .expect(200);
  return login.body.accessToken as string;
}
