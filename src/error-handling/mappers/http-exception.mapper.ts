import { HttpException, HttpStatus } from '@nestjs/common';
import { ErrorMapper, MappedError } from './error-mapper.interface.js';

type HttpPayload = { message?: string | string[]; error?: string };

export class HttpExceptionMapper implements ErrorMapper {
  supports(error: unknown): boolean {
    return error instanceof HttpException;
  }

  toResponse(error: unknown): MappedError {
    const ex = error as HttpException;
    const status = ex.getStatus();
    const payload = ex.getResponse();
    return {
      code: this.codeFor(status),
      status,
      message: this.resolveMessage(payload),
    };
  }

  private codeFor(status: number): string {
    const name = HttpStatus[status];
    return name
      ? name.replace(/_Exception$/i, '').toUpperCase()
      : `HTTP_${status}`;
  }

  private resolveMessage(payload: string | string[] | HttpPayload): string {
    if (Array.isArray(payload)) return payload.join(', ');
    if (typeof payload === 'string') return payload;
    if (Array.isArray(payload?.message)) return payload.message.join(', ');
    return payload?.message ?? payload?.error ?? 'Unexpected error';
  }
}
