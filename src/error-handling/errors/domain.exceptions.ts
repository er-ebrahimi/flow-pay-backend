import { AppException } from './app.exception.js';

export class NotFoundException extends AppException {
  readonly code = 'NOT_FOUND';
  readonly httpStatus = 404;
}

export class ValidationException extends AppException {
  readonly code = 'VALIDATION_FAILED';
  readonly httpStatus = 400;
}

export class UnauthorizedException extends AppException {
  readonly code = 'UNAUTHORIZED';
  readonly httpStatus = 401;
}

export class ConflictException extends AppException {
  readonly code = 'CONFLICT';
  readonly httpStatus = 409;
}

export class InternalException extends AppException {
  readonly code = 'INTERNAL_ERROR';
  readonly httpStatus = 500;
}
