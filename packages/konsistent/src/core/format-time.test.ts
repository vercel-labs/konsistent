import { describe, expect, it } from 'vitest';
import { formatTime } from './format-time.js';

describe('formatTime', () => {
  it('formats sub-second times as milliseconds', () => {
    expect(formatTime(0)).toBe('0ms');
    expect(formatTime(1)).toBe('1ms');
    expect(formatTime(42)).toBe('42ms');
    expect(formatTime(999)).toBe('999ms');
  });

  it('rounds fractional milliseconds', () => {
    expect(formatTime(1.4)).toBe('1ms');
    expect(formatTime(1.5)).toBe('2ms');
    expect(formatTime(99.9)).toBe('100ms');
  });

  it('formats times >= 1s as seconds with one decimal', () => {
    expect(formatTime(1000)).toBe('1.0s');
    expect(formatTime(1500)).toBe('1.5s');
    expect(formatTime(2345)).toBe('2.3s');
    expect(formatTime(10000)).toBe('10.0s');
  });

  it('formats exactly 999ms as milliseconds', () => {
    expect(formatTime(999)).toBe('999ms');
  });

  it('formats exactly 1000ms as seconds', () => {
    expect(formatTime(1000)).toBe('1.0s');
  });
});
