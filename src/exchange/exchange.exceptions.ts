import { AppException } from '../error-handling/errors/app.exception.js';

/**
 * Thrown when a wallet has less money than the exchange it must fund.
 * Live in the exchange feature because "insufficient" is a business verdict
 * (422), not validation; the exchange dialog branches on this exact code to
 * send the user back to the amount input.
 */
export class InsufficientFundsException extends AppException {
  readonly code = 'INSUFFICIENT_BALANCE';
  readonly httpStatus = 422;
}

/** The quote's 60s lockout has passed. */
export class QuoteExpiredException extends AppException {
  readonly code = 'QUOTE_EXPIRED';
  readonly httpStatus = 410;
}

/**
 * Stale quote reused in what was a valid request otherwise. Own code instead
 * of CONFLICT so the client can distinguish "pick another email" (register
 * conflict) from "request a fresh quote".
 */
export class QuoteAlreadyConsumedException extends AppException {
  readonly code = 'QUOTE_ALREADY_CONSUMED';
  readonly httpStatus = 409;
}
