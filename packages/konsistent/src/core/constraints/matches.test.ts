import { describe, expect, it } from 'vitest';
import { validateMatchesConstraint } from './matches.js';

describe('validateMatchesConstraint', () => {
  it('returns true when value matches the regex', () => {
    expect(
      validateMatchesConstraint({ value: 'openai', arg: '^[a-z]+ai$' })
    ).toBe(true);
  });

  it('returns false when value does not match the regex', () => {
    expect(
      validateMatchesConstraint({ value: 'google', arg: '^[a-z]+ai$' })
    ).toBe(false);
  });

  it('returns true for partial matches when regex is not anchored', () => {
    expect(validateMatchesConstraint({ value: 'openai-v2', arg: 'ai' })).toBe(
      true
    );
  });

  it('returns false when arg is undefined', () => {
    expect(validateMatchesConstraint({ value: 'openai' })).toBe(false);
  });

  it('returns false when regex is invalid', () => {
    expect(
      validateMatchesConstraint({ value: 'openai', arg: '[invalid' })
    ).toBe(false);
  });

  it('returns true for empty value matching an empty-allowing regex', () => {
    expect(validateMatchesConstraint({ value: '', arg: '^$' })).toBe(true);
  });

  it('treats regex as case-sensitive by default', () => {
    expect(
      validateMatchesConstraint({ value: 'OpenAI', arg: '^[a-z]+ai$' })
    ).toBe(false);
  });
});
