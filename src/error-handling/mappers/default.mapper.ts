import { ErrorMapper, MappedError } from './error-mapper.interface.js';

export class DefaultMapper implements ErrorMapper {
  supports(_error: unknown): boolean {
    return true;
  }

  toResponse(error: unknown): MappedError {
    return {
      code: 'INTERNAL_ERROR',
      status: 500,
      message: 'An unexpected error occurred',
      context: this.describe(error),
    };
  }

  private describe(error: unknown): Record<string, unknown> {
    if (error instanceof Error) {
      return { originalName: error.name, originalMessage: error.message };
    }
    return { typeof: typeof error };
  }
}
