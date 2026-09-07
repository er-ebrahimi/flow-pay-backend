import { INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

/**
 * Mounts Swagger UI at /docs. Kept as a function so the OpenAPI surface lives
 * in one place, mirroring the real app whether bootstrapped by main.ts or e2e.
 */
export function configureSwagger(app: INestApplication): void {
  const config = new DocumentBuilder()
    .setTitle('FlowPay API')
    .setDescription(
      [
        'Multi-currency wallet and exchange API.',
        '',
        'All routes require `Authorization: Bearer <jwt>` except /auth/register and /auth/login.',
        'Errors are always `{ "error": { "code", "message", "context?" } }` — see docs/API_CONTRACT.md.',
      ].join('\n'),
    )
    .setVersion('1.0')
    // addBearerAuth defines the scheme in components.securitySchemes; without
    // an explicit security requirement it is inert and Swagger UI would authorize
    // a token that never reaches the requests (curl shows no header).
    .addBearerAuth({ type: 'http', scheme: 'bearer', bearerFormat: 'JWT' }, 'jwt')
    .addSecurityRequirements('jwt')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('docs', app, document);
}
