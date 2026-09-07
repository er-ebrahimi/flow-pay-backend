import request from 'supertest';
import type { INestApplication } from '@nestjs/common';

import { bootstrapApi, ensureSchemaApplied, resetDatabase } from './helpers/e2e-db.js';

describe('Currencies (e2e)', () => {
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
    const noToken = await request(app.getHttpServer()).get('/currencies');
    expect(noToken.status).toBe(401);
    expect(noToken.body.error).toMatchObject({ code: 'UNAUTHORIZED' });
  });

  it('lists all seeded currencies sorted by code', async () => {
    const response = await request(app.getHttpServer())
      .get('/currencies')
      .set('Authorization', `Bearer ${await tokenFor(app, 'seed@example.com')}`)
      .expect(200);

    expect(response.body.map((row: { code: string }) => row.code)).toEqual([
      'AED',
      'EUR',
      'GBP',
      'USD',
    ]);
    for (const row of response.body as Array<{ code: string; name: string; decimalPlaces: number }>) {
      expect(row).toMatchObject({ decimalPlaces: 2 });
      expect(row.name.length).toBeGreaterThan(0);
    }
    expect(response.body.some((row: { code: string }) => 'walletCount' in row)).toBe(true);
  });

  it('excludes the requested currency', async () => {
    const response = await request(app.getHttpServer())
      .get('/currencies')
      .set('Authorization', `Bearer ${await tokenFor(app, 'exclude@example.com')}`)
      .query('exclude=USD')
      .expect(200);

    expect(response.body.map((row: { code: string }) => row.code)).toEqual([
      'AED',
      'EUR',
      'GBP',
    ]);
  });

  it('rejects a malformed exclude code with the validation envelope', async () => {
    const response = await request(app.getHttpServer())
      .get('/currencies')
      .set('Authorization', `Bearer ${await tokenFor(app, 'exclude-bad@example.com')}`)
      .query('exclude=usa!!')
      .expect(400);

    expect(response.body.error).toMatchObject({ code: 'VALIDATION_FAILED' });
  });

  it('counts the USD starter wallet in walletCount after registration', async () => {
    const token = await tokenFor(app, 'counter@example.com');
    const response = await request(app.getHttpServer())
      .get('/currencies')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    const usd = (response.body as Array<{ code: string; walletCount: number }>).find(
      (row) => row.code === 'USD',
    );
    // Only the counter user's starter wallet exists in this isolated database,
    // so the entire system's wallet inventory must add up to exactly one.
    expect(usd?.walletCount).toBe(1);
    const totalWallets = (response.body as Array<{ code: string; walletCount: number }>).reduce(
      (acc, row) => acc + row.walletCount,
      0,
    );
    expect(totalWallets).toBe(1);
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
