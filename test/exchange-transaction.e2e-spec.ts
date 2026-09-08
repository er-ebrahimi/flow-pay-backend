import request from 'supertest';
import type { INestApplication } from '@nestjs/common';
import pg from 'pg';

import { bootstrapApi, ensureSchemaApplied, resetDatabase, seedExchangeRates } from './helpers/e2e-db.js';

// Module scope so the scalar() helper assigned in beforeAll can read it too.
let dbClient: pg.Client;

describe('Exchanges (e2e)', () => {
  let app: INestApplication;

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

  it('executes the exchange, updating both wallets and inserting a transaction row', async () => {
    const token = await tokenFor(app, 'exchange@example.com');
    const quote = await createQuote(app, token, '50.00');

    const response = await confirmExchange(app, token, quote.body.quoteId as string, crypto.randomUUID(), (status) => { expect(status).toBe(201); });

    expect(response.body).toMatchObject({
      status: 'COMPLETED',
      fromCurrency: 'USD',
      toCurrency: 'EUR',
      sourceAmount: '50.00',
      fee: quote.body.fee,
      destinationAmount: quote.body.destinationAmount,
    });

    const walletRollUp = await request(app.getHttpServer())
      .get('/wallets')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    const byCode = Object.fromEntries(
      (walletRollUp.body as Array<{ currencyCode: string; balance: string }>).map((row) => [row.currencyCode, row.balance]),
    );
    // Starter wallet holds 100.00; exchanging 50.00 leaves exactly half.
    expect(byCode['USD']).toBe('50.00');
    // A currency the user did not hold before is created by confirm itself.
    expect(byCode['EUR']).toBe(quote.body.destinationAmount as string);
  });

  it('replays the same Idempotency-Key with an identical body and without re-execution', async () => {
    const token = await tokenFor(app, 'replay@example.com');
    const quote = await createQuote(app, token, '50.00');
    const key = crypto.randomUUID();

    const first = await confirmExchange(app, token, quote.body.quoteId as string, key, (status) => { expect(status).toBe(201); });
    const replayed = await confirmExchange(app, token, quote.body.quoteId as string, key, (status) => { expect(status).toBe(200); });
    expect(replayed.body).toEqual(first.body);

    const txCount = await scalar('SELECT count(*)::int AS c FROM "transaction"');
    expect(txCount).toBe(1);
  });

  it('rejects a later confirm on a consumed quote with QUOTE_ALREADY_CONSUMED', async () => {
    const token = await tokenFor(app, 'consumed@example.com');
    const quote = await createQuote(app, token, '10.00');
    await confirmExchange(app, token, quote.body.quoteId as string, crypto.randomUUID(), () => undefined);

    const second = await request(app.getHttpServer())
      .post('/exchanges')
      .set('Authorization', `Bearer ${token}`)
      .set('Idempotency-Key', crypto.randomUUID())
      .send({ quoteId: quote.body.quoteId });

    expect(second.status).toBe(409);
    expect(second.body.error).toMatchObject({ code: 'QUOTE_ALREADY_CONSUMED' });
  });

  it('answers 410 QUOTE_EXPIRED when the confirm arrives after the TTL', async () => {
    const token = await tokenFor(app, 'late@example.com');
    const quote = await createQuote(app, token, '10.00');
    await dbClient.query("UPDATE \"public\".\"exchangeQuote\" SET \"expiresAt\" = now() - interval '5 minutes'");

    const response = await request(app.getHttpServer())
      .post('/exchanges')
      .set('Authorization', `Bearer ${token}`)
      .set('Idempotency-Key', crypto.randomUUID())
      .send({ quoteId: quote.body.quoteId })
      .expect(410);

    expect(response.body.error).toMatchObject({ code: 'QUOTE_EXPIRED' });
  });

  it('fails inside the transaction with INSUFFICIENT_BALANCE on a racing second confirm', async () => {
    const token = await tokenFor(app, 'racer@example.com');
    const first = await createQuote(app, token, '100.00');
    const second = await createQuote(app, token, '40.00');

    await confirmExchange(app, token, first.body.quoteId as string, crypto.randomUUID(), () => undefined);
    const late = await request(app.getHttpServer())
      .post('/exchanges')
      .set('Authorization', `Bearer ${token}`)
      .set('Idempotency-Key', crypto.randomUUID())
      .send({ quoteId: second.body.quoteId })
      .expect(422);

    expect(late.body.error).toMatchObject({ code: 'INSUFFICIENT_BALANCE' });
  });

  it('rejects missing Idempotency-Key header with the validation envelope', async () => {
    const token = await tokenFor(app, 'nokey@example.com');
    const quote = await createQuote(app, token, '10.00');

    const response = await request(app.getHttpServer())
      .post('/exchanges')
      .set('Authorization', `Bearer ${token}`)
      .send({ quoteId: quote.body.quoteId })
      .expect(400);

    expect(response.body.error).toMatchObject({ code: 'VALIDATION_FAILED' });
  });

  it('treats another user\u2019s quote as NOT_FOUND instead of executing it', async () => {
    const owned = await tokenFor(app, 'quoter@example.com');
    const foreignQuote = await createQuote(app, owned, '10.00');
    const intruder = await tokenFor(app, 'window-shopper@example.com');

    const response = await request(app.getHttpServer())
      .post('/exchanges')
      .set('Authorization', `Bearer ${intruder}`)
      .set('Idempotency-Key', crypto.randomUUID())
      .send({ quoteId: foreignQuote.body.quoteId })
      .expect(404);

    expect(response.body.error).toMatchObject({ code: 'NOT_FOUND' });
  });
});

async function createQuote(
  app: INestApplication,
  token: string,
  amount: string,
): Promise<{ body: { quoteId: string; fee: string; destinationAmount: string } }> {
  const response = (await request(app.getHttpServer())
    .post('/exchange-quotes')
    .set('Authorization', `Bearer ${token}`)
    .send({ fromCurrency: 'USD', toCurrency: 'EUR', amount })) as unknown as {
    body: { quoteId: string; fee: string; destinationAmount: string };
  };
  return response;
}

type StatusProbe = (status: number) => void;

async function confirmExchange(
  app: INestApplication,
  token: string,
  quoteId: string,
  key: string,
  probeStatus: StatusProbe,
): Promise<{ status: number; body: Record<string, unknown> }> {
  const response = await request(app.getHttpServer())
    .post('/exchanges')
    .set('Authorization', `Bearer ${token}`)
    .set('Idempotency-Key', key)
    .send({ quoteId });
  probeStatus(response.status);
  return response;
}

async function scalar(sql: string): Promise<number> {
  const result = await dbClient!.query(sql);
  const row = result.rows[0] as Record<string, number>;
  return row[Object.keys(row)[0] as string];
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
