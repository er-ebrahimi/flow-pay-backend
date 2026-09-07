import request from 'supertest';
import type { INestApplication } from '@nestjs/common';

import { bootstrapApi } from './helpers/e2e-db.js';

describe('Swagger (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await bootstrapApi();
  });

  afterAll(async () => {
    await app.close();
  }, 60_000);

  it('serves the OpenAPI document with auth endpoints and bearer scheme', async () => {
    const response = await request(app.getHttpServer()).get('/docs-json');
    expect(response.status).toBe(200);
    const body = response.body;

    expect(body.components?.securitySchemes).toMatchObject({
      jwt: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
    });
    // Paths include a leading /x because Express mounts from / with no global
    // prefix; the account shapes carry the validation constraints.
    expect(body.paths['/auth/register']).toBeTruthy();
    expect(body.paths['/auth/login']).toBeTruthy();
    expect(body.paths['/auth/logout']).toBeTruthy();

    const schemas = body.components?.schemas;
    expect(schemas).toBeTruthy();
    const schemaNames = Object.keys(schemas as Record<string, unknown>);
    expect(schemaNames).toContain('RegisterDto');
    expect(schemaNames).toContain('LoginDto');

    const registerSchema = schemas['RegisterDto'];
    expect(registerSchema).toMatchObject({
      type: 'object',
      properties: expect.objectContaining({
        email: expect.objectContaining({ format: 'email' }),
        password: expect.objectContaining({ minLength: 8, maxLength: 72 }),
      }),
    });
  });

  it('serves the Swagger UI at /docs', async () => {
    const response = await request(app.getHttpServer()).get('/docs');
    expect(response.status).toBe(200);
    expect(response.text).toContain('swagger');
  });
});

