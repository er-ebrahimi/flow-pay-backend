import request from 'supertest';
import type { INestApplication } from '@nestjs/common';

import { bootstrapApi, ensureSchemaApplied, resetDatabase, seedExchangeRates } from './helpers/e2e-db.js';

describe('Dashboard (e2e)', () => {
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

  it('holds unauthenticated requests at the global guard', async () => {
    const noToken = await request(app.getHttpServer()).get('/dashboard');
    expect(noToken.status).toBe(401);
    expect(noToken.body.error).toMatchObject({ code: 'UNAUTHORIZED' });
  });

  it('shows the starter wallet for a fresh user and zero recent history', async () => {
    const token = await tokenFor(app, 'fresh@example.com');

    const response = await request(app.getHttpServer())
      .get('/dashboard')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(response.body).toEqual({
      totalBalanceBase: '100.00',
      baseCurrency: 'USD',
      wallets: [{ currencyCode: 'USD', balance: '100.00' }],
      recentTransactions: [],
    });
  });

  it('totals wallets converted at the active rates and shows recent exchanges', async () => {
    const token = await tokenFor(app, 'dashboard@example.com');
    const quote = await createQuote(app, token, '50.00');
    await confirmExchange(app, token, quote.body.quoteId as string, crypto.randomUUID(), () => undefined);

    const response = await request(app.getHttpServer())
      .get('/dashboard')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    // Exact money split: USD wallet 50.00 counts directly; the EUR wallet
    // (42.24) converts via the seeded EUR→USD rate 1.17 → 49.4208 → 49.42 half-up.
    // Total: 99.42.
    expect(response.body).toMatchObject({
      totalBalanceBase: '99.42',
      baseCurrency: 'USD',
      wallets: expect.arrayContaining([
        { currencyCode: 'USD', balance: '50.00' },
        { currencyCode: 'EUR', balance: '42.24' },
      ]),
    });
    expect((response.body.recentTransactions as unknown[]).length).toBe(1);
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
  probe: (status: number) => void,
): Promise<void> {
  const response = await request(app.getHttpServer())
    .post('/exchanges')
    .set('Authorization', `Bearer ${token}`)
    .set('Idempotency-Key', key)
    .send({ quoteId });
  probe(response.status);
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
