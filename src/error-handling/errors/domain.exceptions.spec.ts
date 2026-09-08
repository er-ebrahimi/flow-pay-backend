import { AppException } from './app.exception.js';
import {
  ConflictException,
  InternalException,
  NotFoundException,
  UnauthorizedException,
  ValidationException,
} from './domain.exceptions.js';

describe('domain exceptions', () => {
  const cases: Array<[new (m: string) => AppException, string, number]> = [
    [NotFoundException, 'NOT_FOUND', 404],
    [ValidationException, 'VALIDATION_FAILED', 400],
    [UnauthorizedException, 'UNAUTHORIZED', 401],
    [ConflictException, 'CONFLICT', 409],
    [InternalException, 'INTERNAL_ERROR', 500],
  ];

  it.each(cases)(
    '%# carries its distinct code and httpStatus',
    (Ctor, code, status) => {
      const ex = new Ctor('boom');
      expect(ex.code).toBe(code);
      expect(ex.httpStatus).toBe(status);
      expect(ex).toBeInstanceOf(AppException);
    },
  );

  it('attaches optional context', () => {
    const ex = new NotFoundException('wallet missing', { walletId: 'w1' });
    expect(ex.context).toEqual({ walletId: 'w1' });
  });
});
