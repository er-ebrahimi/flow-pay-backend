import request from 'supertest';
import type { INestApplication } from '@nestjs/common';

import {
  bootstrapApi,
  ensureSchemaApplied,
  resetDatabase,
} from './helpers/e2e-db.js';

describe('Auth (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    // ensureSchemaApplied shells out to the prisma CLI, which alone can
    // outlive the default 10s hook timeout on a cold run.
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

  it('registers a user and grants them a USD starter wallet token journey', async () => {
    const registerResponse = await request(app.getHttpServer())
      .post('/auth/register')
      .send({ email: 'journey@example.com', password: 'hunter2hunter2' });

    expect(registerResponse.status).toBe(201);
    expect(registerResponse.body).toMatchObject({
      email: 'journey@example.com',
    });
    expect(registerResponse.body.id).toBeTruthy();
    expect(registerResponse.body.createdAt).toBeTruthy();

    const loginResponse = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: 'journey@example.com', password: 'hunter2hunter2' });

    expect(loginResponse.status).toBe(200);
    expect(loginResponse.body.accessToken).toBeTruthy();
    expect(loginResponse.body.expiresIn).toBe(86_400);
  });

  it('rejects a duplicate registration with CONFLICT envelope', async () => {
    await request(app.getHttpServer())
      .post('/auth/register')
      .send({ email: 'dup@example.com', password: 'hunter2hunter2' })
      .expect(201);

    const second = await request(app.getHttpServer())
      .post('/auth/register')
      .send({ email: 'dup@example.com', password: 'hunter2hunter2' });

    expect(second.status).toBe(409);
    expect(second.body.error).toMatchObject({ code: 'CONFLICT' });
  });

  it('rejects invalid credentials with UNAUTHORIZED envelope', async () => {
    await request(app.getHttpServer())
      .post('/auth/register')
      .send({ email: 'login@example.com', password: 'hunter2hunter2' })
      .expect(201);

    const wrongPassword = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: 'login@example.com', password: 'wrong-password-123' });
    expect(wrongPassword.status).toBe(401);
    expect(wrongPassword.body.error).toMatchObject({ code: 'UNAUTHORIZED' });

    const unknownUser = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: 'ghost@example.com', password: 'hunter2hunter2' });
    expect(unknownUser.status).toBe(401);
    expect(unknownUser.body.error).toEqual(wrongPassword.body.error);
  });

  it('holds unauthenticated requests at the global guard with the envelope', async () => {
    // /auth/logout is currently the only protected route; until the wallet/
    // dashboard endpoints exist it doubles as the guard probe.
    const noToken = await request(app.getHttpServer()).post('/auth/logout');
    expect(noToken.status).toBe(401);
    expect(noToken.body.error).toMatchObject({ code: 'UNAUTHORIZED' });
  });

  it('rejects malformed register payloads with VALIDATION_FAILED', async () => {
    const response = await request(app.getHttpServer())
      .post('/auth/register')
      .send({ email: 'not-an-email', password: 'short' });

    expect(response.status).toBe(400);
    expect(response.body.error).toMatchObject({ code: 'VALIDATION_FAILED' });
  });

  it('full journey: register, login, access protected route, logout', async () => {
    await request(app.getHttpServer())
      .post('/auth/register')
      .send({ email: 'flow@example.com', password: 'hunter2hunter2' })
      .expect(201);

    const login = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: 'flow@example.com', password: 'hunter2hunter2' })
      .expect(200);

    const token: string = login.body.accessToken;

    // The token must satisfy the global guard on a real protected route.
    await request(app.getHttpServer())
      .post('/auth/logout')
      .set('Authorization', `Bearer ${token}`)
      .expect(204);

    const usdBalance = await queryScalar(
      "SELECT balance::text FROM wallet WHERE \"currencyCode\" = 'USD'",
    );
    expect(usdBalance).toBe('100.000000');
  });
});

async function queryScalar(sql: string): Promise<unknown> {
  const pg = await import('pg');
  const c = new pg.Client({ connectionString: process.env['DATABASE_URL'] });
  await c.connect();
  const result = await c.query(sql);
  await c.end();
  return result.rows[0][Object.keys(result.rows[0] as object)[0] as string];
}
