import { describe, expect, it } from 'vitest';
import { validateSegmentsConstraint } from './segments.js';

describe('validateSegmentsConstraint', () => {
  it('returns true when value has exactly the expected number of segments', () => {
    expect(
      validateSegmentsConstraint({ value: 'chat-language', arg: '2' })
    ).toBe(true);
  });

  it('returns false when value has fewer segments than expected', () => {
    expect(validateSegmentsConstraint({ value: 'chat', arg: '2' })).toBe(false);
  });

  it('returns false when value has more segments than expected', () => {
    expect(
      validateSegmentsConstraint({ value: 'chat-language-model', arg: '2' })
    ).toBe(false);
  });

  it('returns true for single segment with arg 1', () => {
    expect(validateSegmentsConstraint({ value: 'chat', arg: '1' })).toBe(true);
  });

  it('returns false when arg is undefined', () => {
    expect(validateSegmentsConstraint({ value: 'chat' })).toBe(false);
  });

  it('returns false when arg is not a valid number', () => {
    expect(validateSegmentsConstraint({ value: 'chat', arg: 'abc' })).toBe(
      false
    );
  });

  it('returns false when arg is zero', () => {
    expect(validateSegmentsConstraint({ value: 'chat', arg: '0' })).toBe(false);
  });

  it('returns false when arg is negative', () => {
    expect(validateSegmentsConstraint({ value: 'chat', arg: '-1' })).toBe(
      false
    );
  });

  it('handles underscore-separated values', () => {
    expect(
      validateSegmentsConstraint({ value: 'chat_language', arg: '2' })
    ).toBe(true);
  });

  it('handles camelCase values', () => {
    expect(
      validateSegmentsConstraint({ value: 'chatLanguage', arg: '2' })
    ).toBe(true);
  });
});
