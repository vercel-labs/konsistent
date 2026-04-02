import { describe, expect, it } from 'vitest';
import { PlaceholderValue } from './placeholder.js';

describe('PlaceholderValue', () => {
  describe('toString', () => {
    it('returns raw value', () => {
      expect(new PlaceholderValue({ value: 'openai' }).toString()).toBe(
        'openai'
      );
    });

    it('preserves hyphens', () => {
      expect(new PlaceholderValue({ value: 'test-utils' }).toString()).toBe(
        'test-utils'
      );
    });

    it('preserves underscores', () => {
      expect(new PlaceholderValue({ value: 'test_utils' }).toString()).toBe(
        'test_utils'
      );
    });

    it('handles single character', () => {
      expect(new PlaceholderValue({ value: 'a' }).toString()).toBe('a');
    });
  });

  describe('toPascalCase', () => {
    it('capitalizes single word', () => {
      expect(new PlaceholderValue({ value: 'openai' }).toPascalCase()).toBe(
        'Openai'
      );
    });

    it('handles multi-word hyphenated', () => {
      expect(new PlaceholderValue({ value: 'test-utils' }).toPascalCase()).toBe(
        'TestUtils'
      );
    });

    it('handles underscore-separated', () => {
      expect(new PlaceholderValue({ value: 'test_utils' }).toPascalCase()).toBe(
        'TestUtils'
      );
    });

    it('handles camelCase input', () => {
      expect(new PlaceholderValue({ value: 'testUtils' }).toPascalCase()).toBe(
        'TestUtils'
      );
    });

    it('handles single character', () => {
      expect(new PlaceholderValue({ value: 'a' }).toPascalCase()).toBe('A');
    });

    it('handles multiple hyphens', () => {
      expect(
        new PlaceholderValue({ value: 'my-test-utils' }).toPascalCase()
      ).toBe('MyTestUtils');
    });
  });

  describe('toCamelCase', () => {
    it('lowercases single word', () => {
      expect(new PlaceholderValue({ value: 'Openai' }).toCamelCase()).toBe(
        'openai'
      );
    });

    it('handles multi-word hyphenated', () => {
      expect(new PlaceholderValue({ value: 'test-utils' }).toCamelCase()).toBe(
        'testUtils'
      );
    });

    it('handles underscore-separated', () => {
      expect(new PlaceholderValue({ value: 'test_utils' }).toCamelCase()).toBe(
        'testUtils'
      );
    });

    it('handles single character', () => {
      expect(new PlaceholderValue({ value: 'A' }).toCamelCase()).toBe('a');
    });
  });

  describe('toKebabCase', () => {
    it('lowercases single word', () => {
      expect(new PlaceholderValue({ value: 'Openai' }).toKebabCase()).toBe(
        'openai'
      );
    });

    it('preserves already kebab-case', () => {
      expect(new PlaceholderValue({ value: 'test-utils' }).toKebabCase()).toBe(
        'test-utils'
      );
    });

    it('converts camelCase', () => {
      expect(new PlaceholderValue({ value: 'testUtils' }).toKebabCase()).toBe(
        'test-utils'
      );
    });

    it('converts underscores', () => {
      expect(new PlaceholderValue({ value: 'test_utils' }).toKebabCase()).toBe(
        'test-utils'
      );
    });
  });

  describe('toSnakeCase', () => {
    it('lowercases single word', () => {
      expect(new PlaceholderValue({ value: 'Openai' }).toSnakeCase()).toBe(
        'openai'
      );
    });

    it('converts hyphens', () => {
      expect(new PlaceholderValue({ value: 'test-utils' }).toSnakeCase()).toBe(
        'test_utils'
      );
    });

    it('preserves already snake_case', () => {
      expect(new PlaceholderValue({ value: 'test_utils' }).toSnakeCase()).toBe(
        'test_utils'
      );
    });

    it('converts camelCase', () => {
      expect(new PlaceholderValue({ value: 'testUtils' }).toSnakeCase()).toBe(
        'test_utils'
      );
    });
  });
});
