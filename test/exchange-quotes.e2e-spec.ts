import request from 'supertest';
import type { INestApplication } from '@nestjs/common';

import { bootstrapApi, ensureSchemaApplied, resetDatabase, seedExchangeRates } from './helpers/e2e-db.js';

describe('Exchange quotes (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    ensureSchemaApplied();
    app = await bootstrapApi();
    await resetDatabase();
    await seedExchangeRates();
  }, 120_000);

  afterEach(async () => {
    await resetDatabase();
    await seedExchangeRates();
  }, 30_000);

  afterAll(async () => {
    await app.close();
  }, 60_000);

  it('creates a quote locking rate/fee/destination inside the TTL window', async () => {
    const token = await tokenFor(app, 'quote@example.com');

    const response = await request(app.getHttpServer())
      .post('/exchange-quotes')
      .set('Authorization', `Bearer ${token}`)
      .send({ fromCurrency: 'USD', toCurrency: 'EUR', amount: '100.00' })
      .expect(201);

    expect(response.body).toMatchObject({
      fromCurrency: 'USD',
      toCurrency: 'EUR',
      amount: '100.00',
      fee: '0.75',
      rate: '0.8512',
      destinationAmount: '84.48',
    });
    const ttlSeconds = (new Date(response.body.expiresAt).getTime() - Date.now()) / 1000;
    expect(ttlSeconds).toBeGreaterThan(0);
    expect(ttlSeconds).toBeLessThanOrEqual(60);
  });

  it('rejects same-currency quotes and unused currency with targeted errors', async () => {
    const token = await tokenFor(app, 'same@example.com');

    const sameCurrency = await request(app.getHttpServer())
      .post('/exchange-quotes')
      .set('Authorization', `Bearer ${token}`)
      .send({ fromCurrency: 'USD', toCurrency: 'USD', amount: '100.00' });
    expect(sameCurrency.status).toBe(400);
    expect(sameCurrency.body.error.context).toMatchObject({ reason: 'SAME_CURRENCY' });

    const unknownCurrency = await request(app.getHttpServer())
      .post('/exchange-quotes')
      .set('Authorization', `Bearer ${token}`)
      .send({ fromCurrency: 'XXX', toCurrency: 'EUR', amount: '10.00' })
      .expect(404);
    expect(unknownCurrency.body.error).toMatchObject({ code: 'NOT_FOUND' });
  });

  it('422s when the requested amount exceeds the wallet balance', async () => {
    const token = await tokenFor(app, 'broke@example.com');

    const response = await request(app.getHttpServer())
      .post('/exchange-quotes')
      .set('Authorization', `Bearer ${token}`)
      .send({ fromCurrency: 'USD', toCurrency: 'EUR', amount: '5000.00' })
      .expect(422);

    expect(response.body.error).toMatchObject({ code: 'INSUFFICIENT_BALANCE' });
  });

  it('rejects an amount with wrong precision for the source currency', async () => {
    const token = await tokenFor(app, 'precision@example.com');

    const response = await request(app.getHttpServer())
      .post('/exchange-quotes')
      .set('Authorization', `Bearer ${token}`)
      .send({ fromCurrency: 'USD', toCurrency: 'EUR', amount: '10.555' })
      .expect(400);

    expect(response.body.error.context).toMatchObject({ reason: 'INVALID_AMOUNT' });
  });
});

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
