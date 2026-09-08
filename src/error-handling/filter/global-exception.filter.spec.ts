import { ArgumentsHost } from '@nestjs/common';
import { DefaultMapper } from '../mappers/default.mapper.js';
import { NotFoundException, ValidationException } from '../errors/domain.exceptions.js';
import { ErrorLogger } from '../logger/error-logger.interface.js';
import { AppExceptionMapper } from '../mappers/app-exception.mapper.js';
import { HttpExceptionMapper } from '../mappers/http-exception.mapper.js';
import { ErrorMapper } from '../mappers/error-mapper.interface.js';
import { GlobalExceptionFilter } from './global-exception.filter.js';

function makeHost(): {
  host: ArgumentsHost;
  res: { status: ReturnType<typeof vi.fn>; json: ReturnType<typeof vi.fn> };
} {
  const res = { status: vi.fn().mockReturnThis(), json: vi.fn() };
  const host = {
    switchToHttp: () => ({ getResponse: () => res, getRequest: () => ({}) }),
  } as unknown as ArgumentsHost;
  return { host, res };
}

function makeLogger(): ErrorLogger {
  return { log: vi.fn() };
}

const PLAIN_ERROR = new Error('boom');
const DEV = false;
const PROD = true;

describe('GlobalExceptionFilter', () => {
  it('routes to the first supporting mapper', () => {
    const first: ErrorMapper = {
      supports: vi.fn().mockReturnValue(true),
      toResponse: vi.fn().mockReturnValue({ code: 'FIRST', status: 499, message: 'x' }),
    };
    const filter = new GlobalExceptionFilter(
      [first, new AppExceptionMapper()],
      makeLogger(),
      DEV,
    );
    const { host, res } = makeHost();

    filter.catch(PLAIN_ERROR, host);

    expect(first.toResponse).toHaveBeenCalledOnce();
    expect(res.status).toHaveBeenCalledWith(499);
  });

  it('uses the custom mapper that supports the error, before defaults', () => {
    const custom: ErrorMapper = {
      supports: (e) => e instanceof ValidationException,
      toResponse: () => ({ code: 'WALLET_LOCKED', status: 400, message: 'locked' }),
    };
    const filter = new GlobalExceptionFilter(
      [custom, new AppExceptionMapper(), new HttpExceptionMapper(), new DefaultMapper()],
      makeLogger(),
      DEV,
    );
    const { host, res } = makeHost();

    filter.catch(new ValidationException('nope'), host);

    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        error: expect.objectContaining({ code: 'WALLET_LOCKED' }),
      }),
    );
  });

  it('falls back to DefaultMapper for unmapped errors', () => {
    const filter = new GlobalExceptionFilter(
      [new HttpExceptionMapper()],
      makeLogger(),
      DEV,
    );
    const { host, res } = makeHost();

    filter.catch(PLAIN_ERROR, host);
    filter.catch('a raw string', host);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        error: expect.objectContaining({ code: 'INTERNAL_ERROR' }),
      }),
    );
  });

  it('survives a throwing custom mapper and still answers the envelope', () => {
    const broken: ErrorMapper = {
      supports: () => true,
      toResponse: () => {
        throw new Error('buggy custom mapper');
      },
    };
    const filter = new GlobalExceptionFilter(
      [broken, new DefaultMapper()],
      makeLogger(),
      PROD,
    );
    const { host, res } = makeHost();

    filter.catch(PLAIN_ERROR, host);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred' },
    });
  });

  it('survives a throwing logger and still answers the envelope', () => {
    const throwingLogger: ErrorLogger = {
      log: () => {
        throw new Error('logger down');
      },
    };
    const filter = new GlobalExceptionFilter([new DefaultMapper()], throwingLogger, PROD);
    const { host, res } = makeHost();

    filter.catch(PLAIN_ERROR, host);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledOnce();
  });

  it('omits context in production but keeps code/message', () => {
    const filter = new GlobalExceptionFilter(
      [new AppExceptionMapper(), new DefaultMapper()],
      makeLogger(),
      PROD,
    );
    const { host, res } = makeHost();

    filter.catch(PLAIN_ERROR, host);

    const body = res.json.mock.calls[0][0] as { error: Record<string, unknown> };
    expect(body.error).toEqual({
      code: 'INTERNAL_ERROR',
      message: 'An unexpected error occurred',
    });
  });

  it('includes context in development and logs before responding', () => {
    const ex = new NotFoundException('missing', { walletId: 'w9' });
    const logger = { log: vi.fn() } as unknown as ErrorLogger;
    const filter = new GlobalExceptionFilter([new AppExceptionMapper()], logger, DEV);
    const { host, res } = makeHost();

    filter.catch(ex, host);

    expect(logger.log).toHaveBeenCalledBefore(res.json);
    expect(res.json).toHaveBeenLastCalledWith({
      error: {
        code: 'NOT_FOUND',
        message: 'missing',
        context: { walletId: 'w9' },
      },
    });
  });
});
