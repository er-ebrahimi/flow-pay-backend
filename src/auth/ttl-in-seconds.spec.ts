import { ttlToSeconds } from './ttl-in-seconds.js';

describe('ttlToSeconds', () => {
  it.each([
    ['1d', 86_400],
    ['2h', 7_200],
    ['45m', 2_700],
    ['30s', 30],
    ['3600', 3_600],
  ])('converts "%s" to %i seconds', (ttl, expected) => {
    expect(ttlToSeconds(ttl)).toBe(expected);
  });

  it('returns null for unparsable values', () => {
    expect(ttlToSeconds('tomorrow')).toBeNull();
    expect(ttlToSeconds('')).toBeNull();
    expect(ttlToSeconds(undefined)).toBeNull();
  });
});
