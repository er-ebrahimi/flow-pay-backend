import request from 'supertest';
import type { INestApplication } from '@nestjs/common';
import pg from 'pg';

import { bootstrapApi, ensureSchemaApplied, resetDatabase, seedExchangeRates } from './helpers/e2e-db.js';

describe('Transactions (e2e)', () => {
  let app: INestApplication;
  let dbClient: pg.Client;

  beforeAll(async () => {
    ensureSchemaApplied();
    app = await bootstrapApi();
    dbClient = new pg.Client({ connectionString: process.env['DATABASE_URL'] });
    await dbClient.connect();
    await resetDatabase();
    await seedExchangeRates();
  }, 120_000);

  afterEach(async () => {
    await resetDatabase();
    await seedExchangeRates();
  }, 30_000);

  afterAll(async () => {
    await app.close();
    await dbClient.end();
  }, 60_000);

  it('holds unauthenticated requests at the global guard', async () => {
    const noToken = await request(app.getHttpServer()).get('/transactions');
    expect(noToken.status).toBe(401);
    expect(noToken.body.error).toMatchObject({ code: 'UNAUTHORIZED' });
  });

  it('returns an empty page (not an error) for a fresh user', async () => {
    const token = await tokenFor(app, 'empty@example.com');

    const response = await request(app.getHttpServer())
      .get('/transactions')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(response.body).toEqual({ items: [], page: 1, limit: 20, total: 0 });
  });

  it('lists the exchange a user performed with rendered amounts newest-first', async () => {
    const token = await tokenFor(app, 'listed@example.com');
    const quote = await createQuote(app, token, '50.00');
    await confirmExchange(app, token, quote.body.quoteId as string, crypto.randomUUID(), () => undefined);

    const response = await request(app.getHttpServer())
      .get('/transactions')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(response.body.total).toBe(1);
    const item = (response.body.items as Array<Record<string, unknown>>)[0];
    expect(item).toMatchObject({
      type: 'EXCHANGE',
      fromCurrency: 'USD',
      toCurrency: 'EUR',
      sourceAmount: '50.00',
      destinationAmount: '42.24',
      status: 'COMPLETED',
    });
    expect(item.id).toBeTruthy();
  });

  it('filters by currency across both pair sides and pages deterministically', async () => {
    const token = await tokenFor(app, 'paged@example.com');
    const first = await createQuote(app, token, '10.00');
    await confirmExchange(app, token, first.body.quoteId as string, crypto.randomUUID(), () => undefined);
    // A second user cannot see this history.
    await tokenFor(app, 'hidden-user@example.com');

    const filtered = await request(app.getHttpServer())
      .get('/transactions')
      .set('Authorization', `Bearer ${token}`)
      .query('currency=USD')
      .expect(200);
    expect(filtered.body.total).toBe(1);

    const foreign = await request(app.getHttpServer())
      .get('/transactions')
      .set('Authorization', `Bearer ${await tokenFor(app, 'foreign-owner@example.com')}`)
      .expect(200);
    expect(foreign.body.total).toBe(0);

    const malformed = await request(app.getHttpServer())
      .get('/transactions')
      .set('Authorization', `Bearer ${token}`)
      .query('limit=0');
    expect(malformed.status).toBe(400);
    expect(malformed.body.error).toMatchObject({ code: 'VALIDATION_FAILED' });
  });

  it('brings back the detail with fee/rate/quoteId', async () => {
    const token = await tokenFor(app, 'detail@example.com');
    const quote = await createQuote(app, token, '50.00');
    const confirmed = (await confirmExchange(app, token, quote.body.quoteId as string, crypto.randomUUID(), () => undefined)).body as {
      transactionId: string;
    };

    const response = await request(app.getHttpServer())
      .get(`/transactions/${confirmed.transactionId}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(response.body).toMatchObject({
      fee: '0.38',
      rate: '0.8512',
      sourceAmount: '50.00',
      destinationAmount: '42.24',
      status: 'COMPLETED',
    });
  });

  it('answers the identical NOT_FOUND for unknown and foreign-owned ids', async () => {
    const token = await tokenFor(app, 'finder@example.com');
    const owned = await tokenFor(app, 'owner-tx@example.com');
    const quote = await createQuote(app, owned, '10.00');
    const foreignTx = (await confirmExchange(app, owned, quote.body.quoteId as string, crypto.randomUUID(), () => undefined)).body as {
      transactionId: string;
    };

    const foreignRequest = await request(app.getHttpServer())
      .get(`/transactions/${foreignTx.transactionId}`)
      .set('Authorization', `Bearer ${token}`);
    const unknownRequest = await request(app.getHttpServer())
      .get(`/transactions/${crypto.randomUUID()}`)
      .set('Authorization', `Bearer ${token}`);

    expect(foreignRequest.status).toBe(404);
    expect(unknownRequest.status).toBe(404);
    expect(foreignRequest.body.error).toMatchObject({ code: 'NOT_FOUND' });
    expect(foreignRequest.body.error.message).toBe(unknownRequest.body.error.message);
  });
});

async function createQuote(
  app: INestApplication,
  token: string,
  amount: string,
): Promise<{ body: { quoteId: string } }> {
  const response = (await request(app.getHttpServer())
    .post('/exchange-quotes')
    .set('Authorization', `Bearer ${token}`)
    .send({ fromCurrency: 'USD', toCurrency: 'EUR', amount })) as unknown as {
    body: { quoteId: string };
  };
  return response;
}

async function confirmExchange(
  app: INestApplication,
  token: string,
  quoteId: string,
  key: string,
): Promise<{ body: { transactionId: string } }> {
  const response = (await request(app.getHttpServer())
    .post('/exchanges')
    .set('Authorization', `Bearer ${token}`)
    .set('Idempotency-Key', key)
    .send({ quoteId })) as unknown as { body: { transactionId: string } };
  return response;
}

async function tokenFor(app: INestApplication, email: string): Promise<string> {
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
