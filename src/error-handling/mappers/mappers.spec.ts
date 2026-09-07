import { BadRequestException, ConflictException, HttpException } from '@nestjs/common';

import { AppException } from '../errors/app.exception.js';
import { NotFoundException, ValidationException } from '../errors/domain.exceptions.js';
import { AppExceptionMapper } from './app-exception.mapper.js';
import { DefaultMapper } from './default.mapper.js';
import { HttpExceptionMapper } from './http-exception.mapper.js';
import { ValidationPipeMapper } from './validation-pipe.mapper.js';

describe('AppExceptionMapper', () => {
  const mapper = new AppExceptionMapper();

  it('supports domain exceptions, rejects foreign errors', () => {
    expect(mapper.supports(new NotFoundException('x'))).toBe(true);
    expect(mapper.supports(new Error('plain'))).toBe(false);
    expect(mapper.supports('string')).toBe(false);
  });

  it('maps code/status/message/context', () => {
    const response = mapper.toResponse(
      new ValidationException('bad request', { field: 'email' }),
    );
    expect(response).toEqual({
      code: 'VALIDATION_FAILED',
      status: 400,
      message: 'bad request',
      context: { field: 'email' },
    });
  });
});

describe('ValidationPipeMapper', () => {
  const mapper = new ValidationPipeMapper();

  const validationError = () =>
    new BadRequestException({
      statusCode: 400,
      message: ['email must be an email', 'name is not empty'],
      error: 'Bad Request',
    });

  it('supports only array-payload BadRequestExceptions', () => {
    expect(mapper.supports(validationError())).toBe(true);
    expect(mapper.supports(new BadRequestException('plain message'))).toBe(false);
    expect(mapper.supports(new ConflictException())).toBe(false);
    expect(mapper.supports(new ValidationException('domain'))).toBe(false);
  });

  it('flattens field errors into one message', () => {
    const response = mapper.toResponse(validationError());
    expect(response).toEqual({
      code: 'VALIDATION_FAILED',
      status: 400,
      message: 'email must be an email, name is not empty',
    });
  });
});

describe('HttpExceptionMapper', () => {
  const mapper = new HttpExceptionMapper();

  it('supports any Nest HttpException', () => {
    expect(mapper.supports(new HttpException('nope', 418))).toBe(true);
    expect(mapper.supports(new AppException('domain'))).toBe(false);
  });

  it('derives code and keeps the original status', () => {
    expect(mapper.toResponse(new ConflictException('taken'))).toEqual({
      code: 'CONFLICT',
      status: 409,
      message: 'taken',
    });
  });

  it('handles unknown statuses and object payloads', () => {
    expect(mapper.toResponse(new HttpException({ message: 'odd', tip: true }, 418))).toEqual({
      code: 'I_AM_A_TEAPOT',
      status: 418,
      message: 'odd',
    });
  });

  it('joins string-array messages', () => {
    expect(mapper.toResponse(new HttpException(['a', 'b'], 400)).message).toBe('a, b');
  });
});

describe('DefaultMapper', () => {
  const mapper = new DefaultMapper();

  it('supports everything', () => {
    expect(mapper.supports(undefined)).toBe(true);
    expect(mapper.supports(42)).toBe(true);
  });

  it('returns a generic 500 without leaking internals', () => {
    const response = mapper.toResponse(new Error('DB connection dropped'));
    expect(response).toEqual({
      code: 'INTERNAL_ERROR',
      status: 500,
      message: 'An unexpected error occurred',
      context: {
        originalName: 'Error',
        originalMessage: 'DB connection dropped',
      },
    });
  });
});
