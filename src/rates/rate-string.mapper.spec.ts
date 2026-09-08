import { renderRate } from './rate-string.mapper.js';

describe('renderRate', () => {
  it.each([
    ['0.8512000000', '0.8512'],
    ['1.0000000000', '1.0'],
    ['1.1700000000', '1.17'],
    ['12.5', '12.5'],
    ['2', '2'],
  ])('trims %s to %s', (raw, expected) => {
    expect(renderRate(raw)).toBe(expected);
  });
});
