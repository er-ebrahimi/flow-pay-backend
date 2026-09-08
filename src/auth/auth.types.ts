/** Result of the auth use cases handed to the transport layer. */
export interface AuthCommandResult {
  id: string;
  email: string;
  createdAt: string;
}

export interface LoginResult {
  accessToken: string;
  expiresIn: number;
}

export type DatabaseError = { readonly sqlState?: string; readonly code?: string };

export const UNIQUE_VIOLATION_SQLSTATE = '23505';

/**
 * The Prisma Next postgres runtime raises SqlQueryError carrying the raw
 * SQLSTATE in `sqlState`; plain pg drivers still expose it as `code`.
 */
export function isUniqueViolation(error: unknown): boolean {
  const candidate = error as DatabaseError | undefined;
  const state = candidate?.sqlState ?? candidate?.code;
  return state === UNIQUE_VIOLATION_SQLSTATE;
}
