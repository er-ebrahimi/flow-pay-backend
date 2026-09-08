/**
 * Exact decimal money built on BigInt-scaled integer units. All arithmetic is
 * digit-exact; half-up rounding (away from zero for negatives) is the house
 * policy — precision and rounding are explicit at every step, never a float.
 */
export class Money {
  private constructor(private readonly units: bigint, private readonly scale: number) {}

  /** Parses a decimal string at a fixed scale; null when not valid money. */
  static from(value: string, scale: number): Money | null {
    if (!/^(-)?(0|[1-9]\d*)(\.\d+)?$/.test(value)) return null;
    const negative = value.startsWith('-');
    const [whole = '0', fraction = ''] = (negative ? value.slice(1) : value).split('.');
    const digits = whole + fraction.padEnd(scale, '0').slice(0, scale);
    const units = BigInt(digits);
    return new Money(units * (negative ? -1n : 1n), scale);
  }

  isZero(): boolean {
    return this.units === 0n;
  }

  /** Amounts and fees must not be negative. */
  isNegative(): boolean {
    return this.units < 0n;
  }

  isLessThan(other: Money): boolean {
    return this.units < other.units;
  }

  /** Same-scale addition only; mixing scales is a caller programming error. */
  add(other: Money): Money {
    if (other.scale !== this.scale) throw new Error('money scale mismatch');
    return new Money(this.units + other.units, this.scale);
  }

  /** Same-scale subtraction; negative results are the caller's problem. */
  subtract(other: Money): Money {
    if (other.scale !== this.scale) throw new Error('money scale mismatch');
    return new Money(this.units - other.units, this.scale);
  }

  /** Multiplies by a decimal rate string; result scale is this scale + rate precision. */
  multiply(rate: string): Money {
    const match = /^(-)?(0|[1-9]\d*)(\.\d+)?$/.exec(rate);
    if (match === null) {
      throw new Error(`invalid rate: ${rate}`);
    }
    const rateScale = (rate.split('.')[1] ?? '').length;
    const [whole = '0', rateFraction] = (match[1] === '-' ? rate.slice(1) : rate).split('.');
    const rateUnits = BigInt(whole + (rateFraction ?? '').padEnd(rateScale, '0'));
    return new Money(this.units * rateUnits, this.scale + rateScale);
  }

  /** Rounds half-up away from zero to a smaller scale. */
  roundTo(scale: number): Money {
    const shrink = this.scale - scale;
    if (shrink <= 0) return this;

    const factor = 10n ** BigInt(shrink);
    const quotient = this.units / factor;
    const remainder = this.units % factor;
    const magnitudeHalf = remainder < 0n ? -2n * remainder >= factor : 2n * remainder >= factor;
    const rounded = magnitudeHalf ? quotient + (this.units < 0n ? -1n : 1n) : quotient;
    return new Money(rounded, scale);
  }

  /** Renders at this money's own scale, always that many fractional digits. */
  toDecimalString(): string {
    const negative = this.units < 0n;
    const magnitude = negative ? -this.units : this.units;
    const digits = magnitude.toString().padStart(1 + this.scale, '0');
    const sign = negative ? '-' : '';
    return this.scale === 0
      ? sign + digits
      : sign + `${digits.slice(0, digits.length - this.scale)}.${digits.slice(digits.length - this.scale)}`;
  }
}
