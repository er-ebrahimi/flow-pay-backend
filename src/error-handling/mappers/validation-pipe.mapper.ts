import { BadRequestException } from '@nestjs/common';
import { ErrorMapper, MappedError } from './error-mapper.interface.js';

type ValidationPayload = { message: string | string[] };

/**
 * Handles BadRequestException payloads emitted by nestjs ValidationPipe
 * (class-validator shape: an array of constraint messages).
 */
export class ValidationPipeMapper implements ErrorMapper {
  supports(error: unknown): boolean {
    if (!(error instanceof BadRequestException)) return false;
    const { message } = this.asValidationPayload(error.getResponse());
    return Array.isArray(message);
  }

  toResponse(error: unknown): MappedError {
    const ex = error as BadRequestException;
    const { message } = this.asValidationPayload(ex.getResponse());
    return {
      code: 'VALIDATION_FAILED',
      status: 400,
      message: (Array.isArray(message) ? message : []).join(', '),
    };
  }

  /**
   * This is the only place where the payload is treated as untyped and
   * narrowed structurally, because it crosses the class-validator boundary
   * and its shape is outside this codebase's control.
   */
  private asValidationPayload(payload: unknown): ValidationPayload {
    if (typeof payload !== 'object' || payload === null) {
      return { message: [] };
    }
    const { message } = payload as Record<string, unknown>;
    if (typeof message === 'string') return { message };
    if (Array.isArray(message) && message.every((m) => typeof m === 'string')) {
      return { message: message as string[] };
    }
    return { message: [] };
  }
}
