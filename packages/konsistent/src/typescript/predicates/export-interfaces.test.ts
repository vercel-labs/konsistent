import { describe, expect, it } from 'vitest';
import type { PredicateContext } from '../../core/context.js';
import type { FileStructure } from '../types.js';
import { checkExportInterfaces } from './export-interfaces.js';

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
  interfaces?: FileStructure['interfaces'];
}): FileStructure {
  return {
    exports: opts.exports ?? [],
    imports: [],
    interfaces: opts.interfaces ?? [],
    classes: [],
    functions: [],
    constants: [],
    typeAliases: [],
  };
}

describe('checkExportInterfaces', () => {
  it('returns no diagnostics when interface is exported', () => {
    const result = checkExportInterfaces({
      expected: ['MyInterface'],
      context: createMockContext({ path: 'src/index.ts' }),
      fileStructure: createMockFileStructure({
        exports: [
          {
            name: 'MyInterface',
            kind: 'interface',
            isType: true,
            pos: { line: 1, column: 1 },
          },
        ],
        interfaces: [
          {
            name: 'MyInterface',
            extends: [],
            pos: { line: 1, column: 1 },
          },
        ],
      }),
    });
    expect(result).toEqual([]);
  });

  it('returns no diagnostics when extend is satisfied', () => {
    const result = checkExportInterfaces({
      expected: [{ name: 'MyInterface', extend: 'BaseInterface' }],
      context: createMockContext({ path: 'src/index.ts' }),
      fileStructure: createMockFileStructure({
        exports: [
          {
            name: 'MyInterface',
            kind: 'interface',
            isType: true,
            pos: { line: 5, column: 1 },
          },
        ],
        interfaces: [
          {
            name: 'MyInterface',
            extends: [{ name: 'BaseInterface', typeArguments: [] }],
            pos: { line: 5, column: 1 },
          },
        ],
      }),
    });
    expect(result).toEqual([]);
  });

  it('returns diagnostic with line number when extend is violated', () => {
    const result = checkExportInterfaces({
      expected: [{ name: 'MyInterface', extend: 'BaseInterface' }],
      context: createMockContext({ path: 'src/index.ts' }),
      fileStructure: createMockFileStructure({
        exports: [
          {
            name: 'MyInterface',
            kind: 'interface',
            isType: true,
            pos: { line: 10, column: 3 },
          },
        ],
        interfaces: [
          {
            name: 'MyInterface',
            extends: [{ name: 'OtherInterface', typeArguments: [] }],
            pos: { line: 10, column: 3 },
          },
        ],
      }),
    });
    expect(result).toHaveLength(1);
    expect(result[0].message).toBe(
      'Interface "MyInterface" must extend "BaseInterface"'
    );
    expect(result[0].predicateName).toBe('exportInterfaces');
    expect(result[0].line).toBe(10);
    expect(result[0].column).toBe(3);
  });

  it('returns diagnostic when interface is missing', () => {
    const result = checkExportInterfaces({
      expected: ['MissingInterface'],
      context: createMockContext({ path: 'src/index.ts' }),
      fileStructure: createMockFileStructure({
        exports: [],
        interfaces: [],
      }),
    });
    expect(result).toHaveLength(1);
    expect(result[0].message).toBe(
      'Missing export interface "MissingInterface"'
    );
    expect(result[0].predicateName).toBe('exportInterfaces');
    expect(result[0].filePath).toBe('src/index.ts');
    expect(result[0].line).toBeUndefined();
    expect(result[0].column).toBeUndefined();
  });

  it('resolves template placeholders in interface names', () => {
    const result = checkExportInterfaces({
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
        interfaces: [
          {
            name: 'ButtonProps',
            extends: [],
            pos: { line: 1, column: 1 },
          },
        ],
      }),
    });
    expect(result).toEqual([]);
  });

  it('resolves template placeholders in extend values', () => {
    const result = checkExportInterfaces({
      expected: [{ name: 'MyInterface', extend: '${base}Interface' }],
      context: createMockContext({
        path: 'src/index.ts',
        placeholders: { base: { toString: () => 'Base' } },
      }),
      fileStructure: createMockFileStructure({
        exports: [
          {
            name: 'MyInterface',
            kind: 'interface',
            isType: true,
            pos: { line: 1, column: 1 },
          },
        ],
        interfaces: [
          {
            name: 'MyInterface',
            extends: [{ name: 'BaseInterface', typeArguments: [] }],
            pos: { line: 1, column: 1 },
          },
        ],
      }),
    });
    expect(result).toEqual([]);
  });

  it('includes conventionName when provided', () => {
    const result = checkExportInterfaces({
      expected: ['Missing'],
      context: createMockContext({ path: 'src/index.ts' }),
      fileStructure: createMockFileStructure({ exports: [], interfaces: [] }),
      conventionName: 'interface-convention',
    });
    expect(result[0].conventionName).toBe('interface-convention');
  });

  it('accepts string shorthand expanding to { name }', () => {
    const result = checkExportInterfaces({
      expected: ['Foo'],
      context: createMockContext({ path: 'src/index.ts' }),
      fileStructure: createMockFileStructure({
        exports: [
          {
            name: 'Foo',
            kind: 'interface',
            isType: true,
            pos: { line: 1, column: 1 },
          },
        ],
        interfaces: [
          {
            name: 'Foo',
            extends: [],
            pos: { line: 1, column: 1 },
          },
        ],
      }),
    });
    expect(result).toEqual([]);
  });

  it('returns no diagnostics when allowOmissions is true and interface extends Pick of target', () => {
    const result = checkExportInterfaces({
      expected: [
        {
          name: 'MyInterface',
          extend: { type: 'BaseInterface', allowOmissions: true },
        },
      ],
      context: createMockContext({ path: 'src/index.ts' }),
      fileStructure: createMockFileStructure({
        exports: [
          {
            name: 'MyInterface',
            kind: 'interface',
            isType: true,
            pos: { line: 1, column: 1 },
          },
        ],
        interfaces: [
          {
            name: 'MyInterface',
            extends: [
              { name: 'Pick', typeArguments: ['BaseInterface', "'a' | 'b'"] },
            ],
            pos: { line: 1, column: 1 },
          },
        ],
      }),
    });
    expect(result).toEqual([]);
  });

  it('returns diagnostic when allowOmissions is false and interface extends Pick of target', () => {
    const result = checkExportInterfaces({
      expected: [
        {
          name: 'MyInterface',
          extend: { type: 'BaseInterface' },
        },
      ],
      context: createMockContext({ path: 'src/index.ts' }),
      fileStructure: createMockFileStructure({
        exports: [
          {
            name: 'MyInterface',
            kind: 'interface',
            isType: true,
            pos: { line: 1, column: 1 },
          },
        ],
        interfaces: [
          {
            name: 'MyInterface',
            extends: [
              { name: 'Pick', typeArguments: ['BaseInterface', "'a'"] },
            ],
            pos: { line: 1, column: 1 },
          },
        ],
      }),
    });
    expect(result).toHaveLength(1);
    expect(result[0].message).toBe(
      'Interface "MyInterface" must extend "BaseInterface"'
    );
  });

  it('returns no diagnostics when allowOmissions is true and interface extends Omit of target', () => {
    const result = checkExportInterfaces({
      expected: [
        {
          name: 'MyInterface',
          extend: { type: 'BaseInterface', allowOmissions: true },
        },
      ],
      context: createMockContext({ path: 'src/index.ts' }),
      fileStructure: createMockFileStructure({
        exports: [
          {
            name: 'MyInterface',
            kind: 'interface',
            isType: true,
            pos: { line: 1, column: 1 },
          },
        ],
        interfaces: [
          {
            name: 'MyInterface',
            extends: [
              { name: 'Omit', typeArguments: ['BaseInterface', "'x'"] },
            ],
            pos: { line: 1, column: 1 },
          },
        ],
      }),
    });
    expect(result).toEqual([]);
  });

  it('returns no diagnostics when allowOmissions is true and direct match exists', () => {
    const result = checkExportInterfaces({
      expected: [
        {
          name: 'MyInterface',
          extend: { type: 'BaseInterface', allowOmissions: true },
        },
      ],
      context: createMockContext({ path: 'src/index.ts' }),
      fileStructure: createMockFileStructure({
        exports: [
          {
            name: 'MyInterface',
            kind: 'interface',
            isType: true,
            pos: { line: 1, column: 1 },
          },
        ],
        interfaces: [
          {
            name: 'MyInterface',
            extends: [{ name: 'BaseInterface', typeArguments: [] }],
            pos: { line: 1, column: 1 },
          },
        ],
      }),
    });
    expect(result).toEqual([]);
  });

  it('returns diagnostic when allowOmissions is true but target is not referenced', () => {
    const result = checkExportInterfaces({
      expected: [
        {
          name: 'MyInterface',
          extend: { type: 'BaseInterface', allowOmissions: true },
        },
      ],
      context: createMockContext({ path: 'src/index.ts' }),
      fileStructure: createMockFileStructure({
        exports: [
          {
            name: 'MyInterface',
            kind: 'interface',
            isType: true,
            pos: { line: 1, column: 1 },
          },
        ],
        interfaces: [
          {
            name: 'MyInterface',
            extends: [
              { name: 'Pick', typeArguments: ['OtherInterface', "'a'"] },
            ],
            pos: { line: 1, column: 1 },
          },
        ],
      }),
    });
    expect(result).toHaveLength(1);
    expect(result[0].message).toBe(
      'Interface "MyInterface" must extend "BaseInterface"'
    );
  });

  it('resolves template placeholders in extend object type', () => {
    const result = checkExportInterfaces({
      expected: [
        {
          name: 'MyInterface',
          extend: { type: '${base}Interface', allowOmissions: true },
        },
      ],
      context: createMockContext({
        path: 'src/index.ts',
        placeholders: { base: { toString: () => 'Base' } },
      }),
      fileStructure: createMockFileStructure({
        exports: [
          {
            name: 'MyInterface',
            kind: 'interface',
            isType: true,
            pos: { line: 1, column: 1 },
          },
        ],
        interfaces: [
          {
            name: 'MyInterface',
            extends: [{ name: 'Partial', typeArguments: ['BaseInterface'] }],
            pos: { line: 1, column: 1 },
          },
        ],
      }),
    });
    expect(result).toEqual([]);
  });
});
