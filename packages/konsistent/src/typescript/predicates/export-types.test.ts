import { describe, expect, it } from 'vitest';
import type { PredicateContext } from '../../core/context.js';
import type { FileStructure } from '../types.js';
import { checkExportTypes } from './export-types.js';

function createMockContext(opts: {
  path: string;
  placeholders?: Record<string, { toString(): string }>;
}): PredicateContext {
  const placeholders = opts.placeholders ?? {};
  return {
    path: opts.path,
    placeholders: placeholders as PredicateContext['placeholders'],
    resolveTemplate(t: string): string {
      return t.replace(/\$\{(\w+)\}/g, (_match, name) => {
        const ph = placeholders[name];
        return ph ? ph.toString() : _match;
      });
    },
    fileExists: () => false,
    readDir: () => [],
  };
}

function createMockFileStructure(opts: {
  exports?: FileStructure['exports'];
}): FileStructure {
  return {
    exports: opts.exports ?? [],
    imports: [],
    interfaces: [],
    classes: [],
    functions: [],
    constants: [],
    typeAliases: [],
  };
}

describe('checkExportTypes', () => {
  it('returns no diagnostics when type export is found', () => {
    const result = checkExportTypes({
      expected: ['MyType'],
      context: createMockContext({ path: 'src/index.ts' }),
      fileStructure: createMockFileStructure({
        exports: [
          {
            name: 'MyType',
            kind: 'interface',
            isType: true,
            pos: { line: 1, column: 1 },
          },
        ],
      }),
    });
    expect(result).toEqual([]);
  });

  it('returns diagnostic when type export is missing', () => {
    const result = checkExportTypes({
      expected: ['MyType'],
      context: createMockContext({ path: 'src/index.ts' }),
      fileStructure: createMockFileStructure({ exports: [] }),
    });
    expect(result).toHaveLength(1);
    expect(result[0].message).toBe('Missing export type "MyType"');
    expect(result[0].predicateName).toBe('exportTypes');
    expect(result[0].filePath).toBe('src/index.ts');
  });

  it('ignores non-type exports', () => {
    const result = checkExportTypes({
      expected: ['MyFunc'],
      context: createMockContext({ path: 'src/index.ts' }),
      fileStructure: createMockFileStructure({
        exports: [
          {
            name: 'MyFunc',
            kind: 'function',
            isType: false,
            pos: { line: 1, column: 1 },
          },
        ],
      }),
    });
    expect(result).toHaveLength(1);
    expect(result[0].message).toBe('Missing export type "MyFunc"');
  });

  it('resolves template placeholders', () => {
    const result = checkExportTypes({
      expected: ['${name}Props'],
      context: createMockContext({
        path: 'src/index.ts',
        placeholders: { name: { toString: () => 'Button' } },
      }),
      fileStructure: createMockFileStructure({
        exports: [
          {
            name: 'ButtonProps',
            kind: 'interface',
            isType: true,
            pos: { line: 1, column: 1 },
          },
        ],
      }),
    });
    expect(result).toEqual([]);
  });

  it('returns diagnostic for template-expanded name when missing', () => {
    const result = checkExportTypes({
      expected: ['${name}Props'],
      context: createMockContext({
        path: 'src/index.ts',
        placeholders: { name: { toString: () => 'Button' } },
      }),
      fileStructure: createMockFileStructure({ exports: [] }),
    });
    expect(result).toHaveLength(1);
    expect(result[0].message).toBe('Missing export type "ButtonProps"');
  });

  it('accepts ExportDefinition object form', () => {
    const result = checkExportTypes({
      expected: [{ name: 'Config' }],
      context: createMockContext({ path: 'src/index.ts' }),
      fileStructure: createMockFileStructure({
        exports: [
          {
            name: 'Config',
            kind: 'interface',
            isType: true,
            pos: { line: 1, column: 1 },
          },
        ],
      }),
    });
    expect(result).toEqual([]);
  });

  it('returns no diagnostics when type re-export with matching from is found', () => {
    const result = checkExportTypes({
      expected: [{ name: 'MyType', from: './types' }],
      context: createMockContext({ path: 'src/index.ts' }),
      fileStructure: createMockFileStructure({
        exports: [
          {
            name: 'MyType',
            kind: 're-export',
            from: './types',
            isType: true,
            pos: { line: 1, column: 1 },
          },
        ],
      }),
    });
    expect(result).toEqual([]);
  });

  it('returns diagnostic when from does not match', () => {
    const result = checkExportTypes({
      expected: [{ name: 'MyType', from: './types' }],
      context: createMockContext({ path: 'src/index.ts' }),
      fileStructure: createMockFileStructure({
        exports: [
          {
            name: 'MyType',
            kind: 're-export',
            from: './other',
            isType: true,
            pos: { line: 1, column: 1 },
          },
        ],
      }),
    });
    expect(result).toHaveLength(1);
    expect(result[0].message).toBe(
      'Missing export type "MyType" from "./types"'
    );
  });

  it('resolves template placeholders in from', () => {
    const result = checkExportTypes({
      expected: [{ name: 'MyType', from: './${name}' }],
      context: createMockContext({
        path: 'src/index.ts',
        placeholders: { name: { toString: () => 'types' } },
      }),
      fileStructure: createMockFileStructure({
        exports: [
          {
            name: 'MyType',
            kind: 're-export',
            from: './types',
            isType: true,
            pos: { line: 1, column: 1 },
          },
        ],
      }),
    });
    expect(result).toEqual([]);
  });

  it('does not require from when not specified in object form', () => {
    const result = checkExportTypes({
      expected: [{ name: 'MyType' }],
      context: createMockContext({ path: 'src/index.ts' }),
      fileStructure: createMockFileStructure({
        exports: [
          {
            name: 'MyType',
            kind: 're-export',
            from: './anywhere',
            isType: true,
            pos: { line: 1, column: 1 },
          },
        ],
      }),
    });
    expect(result).toEqual([]);
  });

  it('includes conventionName when provided', () => {
    const result = checkExportTypes({
      expected: ['Missing'],
      context: createMockContext({ path: 'src/index.ts' }),
      fileStructure: createMockFileStructure({ exports: [] }),
      conventionName: 'type-exports',
    });
    expect(result[0].conventionName).toBe('type-exports');
  });
});
