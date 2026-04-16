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

    it('uses kebabToPascalMap when entry exists', () => {
      expect(
        new PlaceholderValue({
          value: 'openai',
          kebabToPascalMap: { openai: 'OpenAI' },
        }).toPascalCase()
      ).toBe('OpenAI');
    });

    it('falls back to default when kebabToPascalMap has no entry', () => {
      expect(
        new PlaceholderValue({
          value: 'cache',
          kebabToPascalMap: { openai: 'OpenAI' },
        }).toPascalCase()
      ).toBe('Cache');
    });

    it('uses camelToPascalMap when entry exists', () => {
      expect(
        new PlaceholderValue({
          value: 'openAI',
          camelToPascalMap: { openAI: 'OpenAI' },
        }).toPascalCase()
      ).toBe('OpenAI');
    });

    it('prefers kebabToPascalMap over camelToPascalMap', () => {
      expect(
        new PlaceholderValue({
          value: 'openai',
          kebabToPascalMap: { openai: 'OpenAI' },
          camelToPascalMap: { openai: 'Openai' },
        }).toPascalCase()
      ).toBe('OpenAI');
    });

    it('falls back to default when camelToPascalMap has no entry', () => {
      expect(
        new PlaceholderValue({
          value: 'testUtils',
          camelToPascalMap: { openAI: 'OpenAI' },
        }).toPascalCase()
      ).toBe('TestUtils');
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

    it('uses kebabToCamelMap when entry exists', () => {
      expect(
        new PlaceholderValue({
          value: 'openai',
          kebabToCamelMap: { openai: 'openAI' },
        }).toCamelCase()
      ).toBe('openAI');
    });

    it('falls back to kebabToPascalMap with lowercased first char', () => {
      expect(
        new PlaceholderValue({
          value: 'graphql',
          kebabToPascalMap: { graphql: 'GraphQL' },
        }).toCamelCase()
      ).toBe('graphQL');
    });

    it('prefers kebabToCamelMap over kebabToPascalMap', () => {
      expect(
        new PlaceholderValue({
          value: 'openai',
          kebabToPascalMap: { openai: 'OpenAI' },
          kebabToCamelMap: { openai: 'openAI' },
        }).toCamelCase()
      ).toBe('openAI');
    });

    it('falls back to default when no map entry exists', () => {
      expect(
        new PlaceholderValue({
          value: 'cache',
          kebabToPascalMap: { openai: 'OpenAI' },
        }).toCamelCase()
      ).toBe('cache');
    });

    it('uses pascalToCamelMap when entry exists', () => {
      expect(
        new PlaceholderValue({
          value: 'OpenAI',
          pascalToCamelMap: { OpenAI: 'openAI' },
        }).toCamelCase()
      ).toBe('openAI');
    });

    it('prefers kebabToCamelMap over pascalToCamelMap', () => {
      expect(
        new PlaceholderValue({
          value: 'openai',
          kebabToCamelMap: { openai: 'openAI' },
          pascalToCamelMap: { openai: 'openai' },
        }).toCamelCase()
      ).toBe('openAI');
    });

    it('falls back to default when pascalToCamelMap has no entry', () => {
      expect(
        new PlaceholderValue({
          value: 'TestUtils',
          pascalToCamelMap: { OpenAI: 'openAI' },
        }).toCamelCase()
      ).toBe('testUtils');
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

    it('uses pascalToKebabMap when entry exists', () => {
      expect(
        new PlaceholderValue({
          value: 'OpenAI',
          pascalToKebabMap: { OpenAI: 'openai' },
        }).toKebabCase()
      ).toBe('openai');
    });

    it('uses camelToKebabMap when entry exists', () => {
      expect(
        new PlaceholderValue({
          value: 'openAI',
          camelToKebabMap: { openAI: 'openai' },
        }).toKebabCase()
      ).toBe('openai');
    });

    it('prefers pascalToKebabMap over camelToKebabMap', () => {
      expect(
        new PlaceholderValue({
          value: 'OpenAI',
          pascalToKebabMap: { OpenAI: 'openai' },
          camelToKebabMap: { OpenAI: 'open-ai' },
        }).toKebabCase()
      ).toBe('openai');
    });

    it('falls back to default when no map entry exists', () => {
      expect(
        new PlaceholderValue({
          value: 'cache',
          pascalToKebabMap: { OpenAI: 'openai' },
        }).toKebabCase()
      ).toBe('cache');
    });
  });

  describe('toFlatCase', () => {
    it('lowercases single word', () => {
      expect(new PlaceholderValue({ value: 'openai' }).toFlatCase()).toBe(
        'openai'
      );
    });

    it('strips hyphens and lowercases', () => {
      expect(new PlaceholderValue({ value: 'test-utils' }).toFlatCase()).toBe(
        'testutils'
      );
    });

    it('strips underscores and lowercases', () => {
      expect(new PlaceholderValue({ value: 'test_utils' }).toFlatCase()).toBe(
        'testutils'
      );
    });

    it('handles camelCase input', () => {
      expect(new PlaceholderValue({ value: 'testUtils' }).toFlatCase()).toBe(
        'testutils'
      );
    });

    it('handles PascalCase input', () => {
      expect(new PlaceholderValue({ value: 'TestUtils' }).toFlatCase()).toBe(
        'testutils'
      );
    });

    it('handles single character', () => {
      expect(new PlaceholderValue({ value: 'A' }).toFlatCase()).toBe('a');
    });
  });

  describe('toNthSegment', () => {
    it('returns first segment of hyphenated value', () => {
      expect(
        new PlaceholderValue({ value: 'foo-bar-baz' }).toNthSegment(0)
      ).toBe('foo');
    });

    it('returns second segment', () => {
      expect(
        new PlaceholderValue({ value: 'foo-bar-baz' }).toNthSegment(1)
      ).toBe('bar');
    });

    it('returns last segment', () => {
      expect(
        new PlaceholderValue({ value: 'foo-bar-baz' }).toNthSegment(2)
      ).toBe('baz');
    });

    it('returns empty string when index out of bounds', () => {
      expect(new PlaceholderValue({ value: 'foo-bar' }).toNthSegment(5)).toBe(
        ''
      );
    });

    it('returns whole value when no hyphens and index is 0', () => {
      expect(new PlaceholderValue({ value: 'openai' }).toNthSegment(0)).toBe(
        'openai'
      );
    });

    it('returns empty string when no hyphens and index is 1', () => {
      expect(new PlaceholderValue({ value: 'openai' }).toNthSegment(1)).toBe(
        ''
      );
    });
  });

  describe('toNthSegmentPascalCase', () => {
    it('capitalizes segment', () => {
      expect(
        new PlaceholderValue({ value: 'foo-bar' }).toNthSegmentPascalCase(0)
      ).toBe('Foo');
    });

    it('capitalizes second segment', () => {
      expect(
        new PlaceholderValue({ value: 'foo-bar' }).toNthSegmentPascalCase(1)
      ).toBe('Bar');
    });

    it('uses kebabToPascalMap when entry exists', () => {
      expect(
        new PlaceholderValue({
          value: 'openai-graphql',
          kebabToPascalMap: { openai: 'OpenAI' },
        }).toNthSegmentPascalCase(0)
      ).toBe('OpenAI');
    });

    it('falls back to default when no map entry', () => {
      expect(
        new PlaceholderValue({
          value: 'openai-graphql',
          kebabToPascalMap: { graphql: 'GraphQL' },
        }).toNthSegmentPascalCase(0)
      ).toBe('Openai');
    });

    it('returns empty string when out of bounds', () => {
      expect(
        new PlaceholderValue({ value: 'foo-bar' }).toNthSegmentPascalCase(5)
      ).toBe('');
    });
  });

  describe('toNthSegmentCamelCase', () => {
    it('lowercases single-word segment', () => {
      expect(
        new PlaceholderValue({ value: 'Foo-bar' }).toNthSegmentCamelCase(0)
      ).toBe('foo');
    });

    it('uses kebabToCamelMap when entry exists', () => {
      expect(
        new PlaceholderValue({
          value: 'openai-graphql',
          kebabToCamelMap: { openai: 'openAI' },
        }).toNthSegmentCamelCase(0)
      ).toBe('openAI');
    });

    it('falls back to kebabToPascalMap with lowercased first char', () => {
      expect(
        new PlaceholderValue({
          value: 'openai-graphql',
          kebabToPascalMap: { graphql: 'GraphQL' },
        }).toNthSegmentCamelCase(1)
      ).toBe('graphQL');
    });

    it('returns empty string when out of bounds', () => {
      expect(
        new PlaceholderValue({ value: 'foo-bar' }).toNthSegmentCamelCase(5)
      ).toBe('');
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

    it('uses pascalToKebabMap when entry exists', () => {
      expect(
        new PlaceholderValue({
          value: 'OpenAI',
          pascalToKebabMap: { OpenAI: 'openai' },
        }).toSnakeCase()
      ).toBe('openai');
    });

    it('uses camelToKebabMap when entry exists', () => {
      expect(
        new PlaceholderValue({
          value: 'openAI',
          camelToKebabMap: { openAI: 'openai' },
        }).toSnakeCase()
      ).toBe('openai');
    });

    it('converts hyphens in mapped value to underscores', () => {
      expect(
        new PlaceholderValue({
          value: 'GraphQL',
          pascalToKebabMap: { GraphQL: 'graph-ql' },
        }).toSnakeCase()
      ).toBe('graph_ql');
    });

    it('falls back to default when no map entry exists', () => {
      expect(
        new PlaceholderValue({
          value: 'cache',
          pascalToKebabMap: { OpenAI: 'openai' },
        }).toSnakeCase()
      ).toBe('cache');
    });
  });
});
