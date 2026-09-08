const UNIT_TO_SECONDS: Record<string, number> = {
  '': 1,
  s: 1,
  m: 60,
  h: 3600,
  d: 86_400,
};

const TTL_PATTERN = /^(\d+)([smhd]?)$/;

/**
 * @param ttl @nestjs/jwt expiresIn notation ("1d", "3600s", "120").
 * @returns The same duration in whole seconds, or null when unparsable.
 */
export function ttlToSeconds(ttl: string | undefined): number | null {
  if (ttl === undefined || ttl === '') return null;
  const match = TTL_PATTERN.exec(ttl.trim());
  if (match === null) return null;
  const [, digits, unit] = match;
  return Number(digits) * UNIT_TO_SECONDS[unit ?? ''];
}
