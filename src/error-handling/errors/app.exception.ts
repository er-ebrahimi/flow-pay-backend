/**
 * Base class for all FlowPay domain exceptions. Every subclass declares a
 * stable machine-readable `code` and the HTTP status the API must return;
 * `context` carries structured details that production responses strip out.
 */
export abstract class AppException extends Error {
  abstract readonly code: string;
  abstract readonly httpStatus: number;
  readonly context?: Record<string, unknown>;

  constructor(message: string, context?: Record<string, unknown>) {
    super(message);
    this.name = new.target.name;
    this.context = context;
  }
}
