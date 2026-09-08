export interface MappedError {
  code: string;
  status: number;
  message: string;
  context?: Record<string, unknown>;
}

export interface ErrorMapper {
  supports(error: unknown): boolean;
  toResponse(error: unknown): MappedError;
}
