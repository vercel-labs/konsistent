import { describe, expect, it } from 'vitest';
import { PlaceholderValue } from './placeholder.js';
import { resolveTemplate } from './template.js';

function makePlaceholders(
  map: Record<string, string>,
  opts?: {
    kebabToPascalMap?: Record<string, string>;
    kebabToCamelMap?: Record<string, string>;
  }
): Record<string, PlaceholderValue> {
  const result: Record<string, PlaceholderValue> = {};
  for (const [key, value] of Object.entries(map)) {
    result[key] = new PlaceholderValue({
      value,
      kebabToPascalMap: opts?.kebabToPascalMap,
      kebabToCamelMap: opts?.kebabToCamelMap,
    });
  }
  return result;
}

describe('resolveTemplate', () => {
  it('resolves ${name} with toString', () => {
    const result = resolveTemplate({
      template: '${name}.ts',
      placeholders: makePlaceholders({ name: 'openai' }),
    });
    expect(result).toBe('openai.ts');
  });

  it('resolves ${name.toPascalCase()}', () => {
    const result = resolveTemplate({
      template: '${name.toPascalCase()}Provider.ts',
      placeholders: makePlaceholders({ name: 'openai' }),
    });
    expect(result).toBe('OpenaiProvider.ts');
  });

  it('resolves ${name.toCamelCase()}', () => {
    const result = resolveTemplate({
      template: '${name.toCamelCase()}.ts',
      placeholders: makePlaceholders({ name: 'test-utils' }),
    });
    expect(result).toBe('testUtils.ts');
  });

  it('resolves ${name.toKebabCase()}', () => {
    const result = resolveTemplate({
      template: '${name.toKebabCase()}-provider.ts',
      placeholders: makePlaceholders({ name: 'testUtils' }),
    });
    expect(result).toBe('test-utils-provider.ts');
  });

  it('resolves ${name.toSnakeCase()}', () => {
    const result = resolveTemplate({
      template: '${name.toSnakeCase()}_config.ts',
      placeholders: makePlaceholders({ name: 'test-utils' }),
    });
    expect(result).toBe('test_utils_config.ts');
  });

  it('leaves unknown placeholder names unchanged', () => {
    const result = resolveTemplate({
      template: '${unknown}.ts',
      placeholders: makePlaceholders({ name: 'openai' }),
    });
    expect(result).toBe('${unknown}.ts');
  });

  it('leaves unknown methods unchanged', () => {
    const result = resolveTemplate({
      template: '${name.toTitleCase()}.ts',
      placeholders: makePlaceholders({ name: 'openai' }),
    });
    expect(result).toBe('${name.toTitleCase()}.ts');
  });

  it('resolves multiple placeholders in one template', () => {
    const result = resolveTemplate({
      template: '${scope.toPascalCase()}${name.toPascalCase()}.ts',
      placeholders: makePlaceholders({ scope: 'core', name: 'openai' }),
    });
    expect(result).toBe('CoreOpenai.ts');
  });

  it('returns template as-is when no placeholders present', () => {
    const result = resolveTemplate({
      template: 'index.ts',
      placeholders: makePlaceholders({ name: 'openai' }),
    });
    expect(result).toBe('index.ts');
  });

  it('resolves toPascalCase using kebabToPascalMap', () => {
    const result = resolveTemplate({
      template: '${name.toPascalCase()}Provider.ts',
      placeholders: makePlaceholders(
        { name: 'openai' },
        { kebabToPascalMap: { openai: 'OpenAI' } }
      ),
    });
    expect(result).toBe('OpenAIProvider.ts');
  });

  it('resolves toCamelCase falling back to kebabToPascalMap', () => {
    const result = resolveTemplate({
      template: 'create${name.toPascalCase()}',
      placeholders: makePlaceholders(
        { name: 'graphql' },
        { kebabToPascalMap: { graphql: 'GraphQL' } }
      ),
    });
    expect(result).toBe('createGraphQL');
  });
});
