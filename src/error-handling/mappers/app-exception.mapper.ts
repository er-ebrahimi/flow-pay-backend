import { AppException } from '../errors/app.exception.js';
import { ErrorMapper, MappedError } from './error-mapper.interface.js';

export class AppExceptionMapper implements ErrorMapper {
  supports(error: unknown): boolean {
    return error instanceof AppException;
  }

  toResponse(error: unknown): MappedError {
    const ex = error as AppException;
    return {
      code: ex.code,
      status: ex.httpStatus,
      message: ex.message,
      context: ex.context,
    };
  }
}
