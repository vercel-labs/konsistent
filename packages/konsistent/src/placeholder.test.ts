import { describe, expect, it } from 'vitest';
import { PlaceholderValue } from './core/placeholder.js';

describe('placeholder (re-export check)', () => {
  it('PlaceholderValue is importable from core', () => {
    const pv = new PlaceholderValue({ value: 'test' });
    expect(pv.toString()).toBe('test');
  });
});
