import request from 'supertest';
import type { INestApplication } from '@nestjs/common';

import { bootstrapApi, ensureSchemaApplied, resetDatabase, seedExchangeRates } from './helpers/e2e-db.js';
import { PrismaService } from '../src/prisma/prisma.service.js';

describe('probe', () => {
  let app: INestApplication;

  beforeAll(async () => {
    ensureSchemaApplied();
    app = await bootstrapApi();
    await resetDatabase();
    await seedExchangeRates();
  }, 120_000);

  afterAll(async () => {
    await app.close();
  }, 60_000);

  it('dumps the confirm state', async () => {
    const prisma = app.get(PrismaService, { strict: false });

    const walletBefore = await prisma.db.orm.public.Wallet.first({ currencyCode: 'USD' });
    console.log('PROBE_BEFORE', JSON.stringify(walletBefore));

    const server = app.getHttpServer();
    await request(server).post('/auth/register').send({ email: 'probe@example.com', password: 'hunter2hunter2' }).expect(201);
    const login = await request(server).post('/auth/login').send({ email: 'probe@example.com', password: 'hunter2hunter2' }).expect(200);
    const token = login.body.accessToken as string;

    const quote = await request(server)
      .post('/exchange-quotes')
      .set('Authorization', `Bearer ${token}`)
      .send({ fromCurrency: 'USD', toCurrency: 'EUR', amount: '50.00' })
      .expect(201);
    const quoteId = (quote.body as { quoteId: string }).quoteId;

    await request(server)
      .post('/exchanges')
      .set('Authorization', `Bearer ${token}`)
      .set('Idempotency-Key', crypto.randomUUID())
      .send({ quoteId })
      .expect(201);

    const walletAfter = await prisma.db.orm.public.Wallet.first({ currencyCode: 'USD' });
    console.log('PROBE_AFTER', JSON.stringify(walletAfter));
    expect(walletAfter).toBeTruthy();
  });
});

