import { renderBalance } from './balance.mapper.js';

describe('renderBalance', () => {
  it.each([
    ['100.000000', 2, '100.00'],
    ['10000.000000', 2, '10000.00'],
    ['0.000000', 2, '0.00'],
    ['0.333333', 2, '0.33'],
    ['0.999999', 2, '1.00'],
    ['0.005000', 2, '0.01'],
    ['12.550000', 1, '12.6'],
    ['999.999999', 3, '1000.000'],
    ['100.000000', 6, '100.000000'],
    ['100.5', 0, '101'],
    ['0.4', 0, '0'],
  ])('renders %s at %d places as %s', (raw, scale, expected) => {
    expect(renderBalance(raw, scale)).toBe(expected);
  });

  it('keeps the sign of negative balances', () => {
    expect(renderBalance('-12.500000', 1)).toBe('-12.5');
    expect(renderBalance('-0.555555', 2)).toBe('-0.56');
  });
});
