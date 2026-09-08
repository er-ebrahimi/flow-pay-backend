export const UNIQUE_VIOLATION_SQLSTATE = '23505';

export type DatabaseError = { readonly sqlState?: string; readonly code?: string };

/**
 * The Prisma Next postgres runtime raises SqlQueryError with SQLSTATE in
 * `sqlState`; plain pg drivers still surface it as `code`.
 */
export function isUniqueViolation(error: unknown): boolean {
  const candidate = error as DatabaseError | undefined;
  const state = candidate?.sqlState ?? candidate?.code;
  return state === UNIQUE_VIOLATION_SQLSTATE;
}
