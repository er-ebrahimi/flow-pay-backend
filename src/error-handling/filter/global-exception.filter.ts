import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  Inject,
} from '@nestjs/common';
import type { Response } from 'express';
import type { ErrorLogger } from '../logger/error-logger.interface.js';
import { ERROR_LOGGER, ERROR_MAPPERS, IS_PRODUCTION } from '../tokens/tokens.js';
import type { ErrorMapper, MappedError } from '../mappers/error-mapper.interface.js';
import { DefaultMapper } from '../mappers/default.mapper.js';

type ExposedError = { code: string; message: string; context?: Record<string, unknown> };

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly defaultMapper = new DefaultMapper();

  constructor(
    @Inject(ERROR_MAPPERS) private readonly mappers: ErrorMapper[],
    @Inject(ERROR_LOGGER) private readonly errorLogger: ErrorLogger,
    @Inject(IS_PRODUCTION) private readonly isProduction: boolean,
  ) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<Response>();
    const mapped = this.safeMap(exception);
    this.safeLog(exception, mapped);

    response.status(mapped.status).json({ error: this.expose(mapped) });
  }

  private safeMap(exception: unknown): MappedError {
    try {
      const mapper =
        this.mappers.find((m) => m.supports(exception)) ?? this.defaultMapper;
      return mapper.toResponse(exception);
    } catch {
      return this.defaultMapper.toResponse(exception);
    }
  }

  private safeLog(exception: unknown, mapped: MappedError): void {
    try {
      this.errorLogger.log(exception, { error: mapped });
    } catch {
      // Logging must never take precedence over the error response itself.
    }
  }

  /**
   * Production responses omit context entirely so internals never leave the
   * process; development keeps the structured context for debugging.
   */
  private expose(mapped: MappedError): ExposedError {
    const { code, message, context } = mapped;
    return this.isProduction ? { code, message } : { code, message, context };
  }
}
