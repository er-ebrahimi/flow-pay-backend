import { Test } from '@nestjs/testing';
import { APP_FILTER } from '@nestjs/core';

import { ErrorHandlingModule } from './error-handling.module.js';
import { NestErrorLoggerService } from './logger/nest-error-logger.service.js';
import { ErrorMapper } from './mappers/error-mapper.interface.js';
import { ERROR_LOGGER, ERROR_MAPPERS, IS_PRODUCTION } from './tokens/tokens.js';

class WalletLockedMapper implements ErrorMapper {
  supports(error: unknown): boolean {
    return error instanceof Error && (error as Error).message === 'wallet-locked';
  }
  toResponse(): { code: string; status: number; message: string } {
    return { code: 'WALLET_LOCKED', status: 409, message: 'locked' };
  }
}

describe('ErrorHandlingModule.forRoot', () => {
  it('registers the global filter and merges custom mappers before defaults', async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [ErrorHandlingModule.forRoot({ mappers: [WalletLockedMapper] })],
    }).compile();

    const mappers = moduleRef.get<ErrorMapper[]>(ERROR_MAPPERS);
    expect(mappers[0]).toBeInstanceOf(WalletLockedMapper);
    expect(mappers[mappers.length - 1]!.supports(undefined)).toBe(true);
    expect(mappers).toHaveLength(5);

    expect(ErrorHandlingModule.forRoot({ mappers: [WalletLockedMapper] }).providers?.some(
      (p) => (p as { provide?: unknown }).provide === APP_FILTER,
    )).toBe(true);
  });

  it('wires ERROR_LOGGER to the Nest implementation by default', async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [ErrorHandlingModule.forRoot()],
    }).compile();

    expect(moduleRef.get(ERROR_LOGGER)).toBeInstanceOf(NestErrorLoggerService);
    expect(moduleRef.get(ERROR_MAPPERS)).toHaveLength(4);
  });

  it('honors a custom logger class via options', async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [ErrorHandlingModule.forRoot({ loggerClass: StubDebugLogger })],
    }).compile();

    expect(moduleRef.get(ERROR_LOGGER)).toBeInstanceOf(StubDebugLogger);
  });

  it('resolves IS_PRODUCTION from the controlled factory', async () => {
    // TODO: error-handling-flake (observed once in a parallel full-suite run,
    // passed isolated) - Replace this process.env mutation with an overridable
    // IS_PRODUCTION factory injected through ErrorHandlingModule.forRoot()
    // options if the flake recurs.
    process.env['NODE_ENV'] = 'development';
    try {
      const moduleRef = await Test.createTestingModule({
        imports: [ErrorHandlingModule.forRoot()],
      }).compile();

      expect(moduleRef.get(IS_PRODUCTION)).toBe(false);
    } finally {
      delete process.env['NODE_ENV'];
    }
  });
});

class StubDebugLogger {
  log(): void {}
}
