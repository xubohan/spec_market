import { describe, expect, it } from 'vitest';
import { buildSpecLink } from './api';

describe('buildSpecLink', () => {
  it('returns a spec path', () => {
    expect(buildSpecLink('abc123')).toBe('/specs/abc123');
  });
});
