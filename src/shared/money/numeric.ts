import type { Numeric } from '@prisma/orm-postgres/target/codec-types';

export type Numeric18x6 = Numeric<18, 6>;
export type Numeric18x10 = Numeric<18, 10>;

/**
 * Branded writes for the contract's numeric columns: strings are the wire
 * format, and these casts keep the precision facts attached at the call-site
 * instead of leaking `string` into the ORM types.
 */
export function money6(value: string): Numeric18x6 {
  return value as unknown as Numeric18x6;
}

export function rate10(value: string): Numeric18x10 {
  return value as unknown as Numeric18x10;
}
