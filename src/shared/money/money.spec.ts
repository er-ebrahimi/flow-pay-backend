import { Money } from './money.js';

describe('Money', () => {
  it('parses and renders at a fixed scale', () => {
    expect(Money.from('100', 2)?.toDecimalString()).toBe('100.00');
    expect(Money.from('10.5', 2)?.toDecimalString()).toBe('10.50');
    expect(Money.from('-1.25', 2)?.toDecimalString()).toBe('-1.25');
    expect(Money.from('0', 0)?.toDecimalString()).toBe('0');
  });

  it('rejects non-money strings', () => {
    expect(Money.from('abc', 2)).toBeNull();
    expect(Money.from('1.2.3', 2)).toBeNull();
    expect(Money.from('', 2)).toBeNull();
    expect(Money.from('01.0', 2)).toBeNull();
  });

  it('adds same-scale values exactly', () => {
    const sum = Money.from('0.10', 4)!.add(Money.from('0.25', 4));
    expect(sum.toDecimalString()).toBe('0.3500');
  });

  it('multiplies by a rate at exact precision', () => {
    const product = Money.from('990.00', 2).multiply('0.8612');
    expect(product.roundTo(2).toDecimalString()).toBe('852.59');
  });

  it('rounds half-up when downsizing the scale', () => {
    expect(Money.from('0.005', 3).roundTo(2).toDecimalString()).toBe('0.01');
    expect(Money.from('0.0049', 3).roundTo(2).toDecimalString()).toBe('0.00');
    expect(Money.from('2.555', 3).roundTo(2).toDecimalString()).toBe('2.56');
  });

  it('supports comparisons for balance checks', () => {
    const balance = Money.from('100.00', 2)!;
    expect(balance.isLessThan(Money.from('100.01', 2))).toBe(true);
    expect(Money.from('负', 2)).toBeNull();
  });

  it('flags negative amounts for validation call-sites', () => {
    expect(Money.from('-5.00', 2)?.isNegative()).toBe(true);
    expect(Money.from('5.00', 2)?.isNegative()).toBe(false);
    expect(Money.from('0.00', 2)?.isZero()).toBe(true);
  });
});
