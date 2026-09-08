/**
 * Normalizes the DB's numeric(18,10) rate strings ("0.8512000000") to their
 * exact stored value with no trailing zeros ("0.8512"). Pure presentation —
 * the stored rate is untouched until a quote locks it in.
 */
export function renderRate(rawRate: string): string {
  const [integer = '0', fraction = ''] = rawRate.split('.');
  if (fraction === undefined || fraction.length === 0) return rawRate;
  const trimmed = fraction.replace(/0+$/, '');
  return `${integer}.${trimmed === '' ? '0' : trimmed}`;
}
