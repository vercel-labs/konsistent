import { describe, expect, it } from 'vitest';
import type { PredicateContext } from '../core/context.js';
import { PlaceholderValue } from '../core/placeholder.js';
import { resolveTemplate } from '../core/template.js';
import { checkHaveFiles } from './have-files.js';

function createMockContext(opts: {
  path: string;
  existingFiles?: Set<string>;
  placeholders?: Record<string, PlaceholderValue>;
}): PredicateContext {
  const existingFiles = opts.existingFiles ?? new Set<string>();
  const placeholders = opts.placeholders ?? {};
  return {
    path: opts.path,
    placeholders,
    resolveTemplate: (template: string) =>
      resolveTemplate({ template, placeholders }),
    fileExists: (rel: string) => existingFiles.has(rel),
    readDir: () => [],
  };
}

describe('checkHaveFiles', () => {
  it('returns no diagnostics when all files exist', () => {
    const result = checkHaveFiles({
      expected: ['index.ts', 'manifest.json'],
      context: createMockContext({
        path: 'plugins/auth',
        existingFiles: new Set(['index.ts', 'manifest.json']),
      }),
    });
    expect(result).toEqual([]);
  });

  it('returns diagnostic for each missing file', () => {
    const result = checkHaveFiles({
      expected: ['index.ts', 'manifest.json', 'README.md'],
      context: createMockContext({
        path: 'plugins/auth',
        existingFiles: new Set(['index.ts']),
      }),
    });
    expect(result).toHaveLength(2);
    expect(result[0].message).toBe('Missing required file: manifest.json');
    expect(result[1].message).toBe('Missing required file: README.md');
  });

  it('resolves templates in file names', () => {
    const placeholders = {
      name: new PlaceholderValue({ value: 'openai' }),
    };
    const result = checkHaveFiles({
      expected: ['${name.toPascalCase()}Provider.ts'],
      context: createMockContext({
        path: 'packages/openai',
        existingFiles: new Set(['OpenaiProvider.ts']),
        placeholders,
      }),
    });
    expect(result).toEqual([]);
  });

  it('reports missing template-resolved file', () => {
    const placeholders = {
      name: new PlaceholderValue({ value: 'openai' }),
    };
    const result = checkHaveFiles({
      expected: ['${name.toPascalCase()}Provider.ts'],
      context: createMockContext({
        path: 'packages/openai',
        existingFiles: new Set(),
        placeholders,
      }),
    });
    expect(result).toHaveLength(1);
    expect(result[0].message).toBe('Missing required file: OpenaiProvider.ts');
  });

  it('includes conventionName when provided', () => {
    const result = checkHaveFiles({
      expected: ['missing.ts'],
      context: createMockContext({ path: 'src' }),
      conventionName: 'test-rule',
    });
    expect(result[0].conventionName).toBe('test-rule');
  });

  it('sets predicateName to haveFiles', () => {
    const result = checkHaveFiles({
      expected: ['missing.ts'],
      context: createMockContext({ path: 'src' }),
    });
    expect(result[0].predicateName).toBe('haveFiles');
  });
});
