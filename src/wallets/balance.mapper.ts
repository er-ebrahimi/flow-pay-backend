/**
 * Renders a DB numeric string at the currency's own number of decimal places.
 *
 * Rounds half-up on the magnitude instead of truncating: a financial balance
 * must never silently lose the tail digits truncation would hide. All math is
 * digit-string arithmetic — no float round-trips for exact money values.
 */
export function renderBalance(raw: string, decimalPlaces: number): string {
  const negative = raw.startsWith('-');
  const [whole = '0', fraction = ''] = (negative ? raw.slice(1) : raw).split('.');
  const scale = Math.max(0, decimalPlaces);

  const integerDigits = whole.length;
  const combined = whole + fraction;
  const dropped = Number(fraction[scale] ?? '0');
  const kept = combined.slice(0, integerDigits + scale);
  const digits = dropped >= 5 ? addOne(kept) : kept;
  const normalized = digits.padStart(integerDigits + scale, '0');
  // A carry (e.g. 999.999999 -> 1000.000000) widens the integer part, so the
  // split must derive from the final digit count, never the original length.
  const splitAt = normalized.length - scale;

  const magnitude =
    scale > 0
      ? `${normalized.slice(0, splitAt)}.${normalized.slice(splitAt)}`
      : (normalized || '0');
  return (negative ? '-' : '') + magnitude;
}

/** Digit-string increment, no float round-trips. */
function addOne(digits: string): string {
  const out = [...digits];
  for (let index = out.length - 1; index >= 0; index -= 1) {
    if (out[index] === '9') {
      out[index] = '0';
      if (index === 0) {
        out.unshift('1');
        break;
      }
      continue;
    }
    out[index] = String(Number(out[index]) + 1);
    break;
  }
  return out.join('');
}
