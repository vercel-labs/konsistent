import { describe, expect, it } from 'vitest';
import { getVersion } from './version.js';

describe('getVersion', () => {
  it('returns the version string from package.json', () => {
    const version = getVersion();
    expect(version).toBe('0.0.0');
  });

  it('returns a string', () => {
    expect(typeof getVersion()).toBe('string');
  });
});
