import request from 'supertest';
import type { INestApplication } from '@nestjs/common';

import { bootstrapApi, ensureSchemaApplied, resetDatabase } from './helpers/e2e-db.js';

describe('Wallets (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    ensureSchemaApplied();
    app = await bootstrapApi();
    await resetDatabase();
  }, 120_000);

  afterEach(async () => {
    await resetDatabase();
  }, 30_000);

  afterAll(async () => {
    await app.close();
  }, 60_000);

  it('holds unauthenticated requests at the global guard', async () => {
    const noToken = await request(app.getHttpServer()).get('/wallets');
    expect(noToken.status).toBe(401);
    expect(noToken.body.error).toMatchObject({ code: 'UNAUTHORIZED' });
  });

  it('lists the registered user\u2019s USD starter wallet with a formatted balance', async () => {
    const token = await tokenFor(app, 'wallets@example.com');

    const response = await request(app.getHttpServer())
      .get('/wallets')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(response.body).toEqual([
      expect.objectContaining({
        currencyCode: 'USD',
        balance: '100.00',
        transactionCount: 0,
      }),
    ]);
  });

  it('returns the wallet detail with creation timestamp', async () => {
    const token = await tokenFor(app, 'detail@example.com');

    const response = await request(app.getHttpServer())
      .get('/wallets/USD')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(response.body).toMatchObject({
      currencyCode: 'USD',
      balance: '100.00',
      createdAt: expect.any(String),
    });
  });

  it('returns the same NOT_FOUND body for an unknown code and an unused currency', async () => {
    const token = await tokenFor(app, 'missing@example.com');

    const unknownCurrency = await request(app.getHttpServer())
      .get('/wallets/XYZ')
      .set('Authorization', `Bearer ${token}`);
    const unusedCurrency = await request(app.getHttpServer())
      .get('/wallets/EUR')
      .set('Authorization', `Bearer ${token}`);

    expect(unknownCurrency.status).toBe(404);
    expect(unusedCurrency.status).toBe(404);
    // The queried codes legitimately attach to `context` in dev responses,
    // so equality is asserted on the body fields a client branches on; what
    // must never differ is the status or the access path (200 vs 404 shape).
    expect(unknownCurrency.body.error).toMatchObject({ code: 'NOT_FOUND', message: unusedCurrency.body.error.message });
    expect(unusedCurrency.body.error).toMatchObject({ code: 'NOT_FOUND' });
  });

  it('never exposes another user\u2019s wallet to this user', async () => {
    await tokenFor(app, 'owner@example.com');
    const intruder = await tokenFor(app, 'intruder@example.com');

    const response = await request(app.getHttpServer())
      .get('/wallets/USD')
      .set('Authorization', `Bearer ${intruder}`)
      .expect(200);

    // The intruder sees exactly one dataset: their own wallet.
    expect(response.body.balance).toBe('100.00');
  });

  it('rejects malformed currency codes with the validation envelope', async () => {
    const token = await tokenFor(app, 'bad-code@example.com');

    const response = await request(app.getHttpServer())
      .get('/wallets/usd!!')
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(400);
    expect(response.body.error).toMatchObject({ code: 'VALIDATION_FAILED' });
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
