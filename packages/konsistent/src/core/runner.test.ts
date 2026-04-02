import { describe, expect, it, vi } from 'vitest';
import type { ConfigV1 } from '../config/schema.js';
import type { FileSystem } from './filesystem.js';
import { run } from './runner.js';

function createMockFileSystem(opts: {
  globResults?: Map<string, string[]>;
  files?: Set<string>;
  directories?: Set<string>;
}): FileSystem {
  const globResults = opts.globResults ?? new Map<string, string[]>();
  const files = opts.files ?? new Set<string>();
  const directories = opts.directories ?? new Set<string>();
  return {
    glob(patterns: string[]): Promise<string[]> {
      const key = patterns.sort().join(',');
      return Promise.resolve(globResults.get(key) ?? []);
    },
    isDirectory: (p: string) => directories.has(p),
    isFile: (p: string) => files.has(p),
    fileExists: (p: string) => files.has(p) || directories.has(p),
    readDir: () => [],
    readFile: () => '',
  };
}

describe('run', () => {
  it('returns empty diagnostics for empty conventions', async () => {
    const config: ConfigV1 = { version: 'v1', conventions: [] };
    const result = await run({
      config,
      fileSystem: createMockFileSystem({}),
    });
    expect(result).toEqual([]);
  });

  it('returns diagnostics when haveType fails', async () => {
    const config: ConfigV1 = {
      version: 'v1',
      conventions: [
        {
          name: 'source-files',
          paths: 'src/**/*.ts',
          must: { haveType: 'file' },
        },
      ],
    };
    const fs = createMockFileSystem({
      globResults: new Map([['src/**/*.ts', ['src/utils']]]),
      directories: new Set(['src/utils']),
    });
    const result = await run({ config, fileSystem: fs });
    expect(result).toHaveLength(1);
    expect(result[0].message).toBe('Expected a file but found a directory');
    expect(result[0].conventionName).toBe('source-files');
  });

  it('returns no diagnostics when haveType matches', async () => {
    const config: ConfigV1 = {
      version: 'v1',
      conventions: [
        {
          paths: 'src/**/*.ts',
          must: { haveType: 'file' },
        },
      ],
    };
    const fs = createMockFileSystem({
      globResults: new Map([['src/**/*.ts', ['src/index.ts']]]),
      files: new Set(['src/index.ts']),
    });
    const result = await run({ config, fileSystem: fs });
    expect(result).toEqual([]);
  });

  it('normalizes paths string to array', async () => {
    const config: ConfigV1 = {
      version: 'v1',
      conventions: [
        {
          paths: 'src/**',
          must: { haveType: 'directory' },
        },
      ],
    };
    const fs = createMockFileSystem({
      globResults: new Map([['src/**', ['src/components']]]),
      directories: new Set(['src/components']),
    });
    const result = await run({ config, fileSystem: fs });
    expect(result).toEqual([]);
  });

  it('handles array paths', async () => {
    const config: ConfigV1 = {
      version: 'v1',
      conventions: [
        {
          paths: ['src/**/*.ts', 'lib/**/*.ts'],
          must: { haveType: 'file' },
        },
      ],
    };
    const fs = createMockFileSystem({
      globResults: new Map([
        ['lib/**/*.ts,src/**/*.ts', ['src/a.ts', 'lib/b.ts']],
      ]),
      files: new Set(['src/a.ts', 'lib/b.ts']),
    });
    const result = await run({ config, fileSystem: fs });
    expect(result).toEqual([]);
  });

  it('silently skips unrecognized predicate keys', async () => {
    const config: ConfigV1 = {
      version: 'v1',
      conventions: [
        {
          paths: 'src/**',
          must: {} as ConfigV1['conventions'][0]['must'],
        },
      ],
    };
    const fs = createMockFileSystem({
      globResults: new Map([['src/**', ['src/index.ts']]]),
      files: new Set(['src/index.ts']),
    });
    const result = await run({ config, fileSystem: fs });
    expect(result).toEqual([]);
  });

  it('evaluates must block when if.hasFile condition is met', async () => {
    const config: ConfigV1 = {
      version: 'v1',
      conventions: [
        {
          name: 'conditional-rule',
          paths: 'src/**/*.ts',
          must: [
            {
              if: { hasFile: 'schema.ts' },
              must: { haveType: 'directory' },
            },
          ],
        },
      ],
    };
    const fs = createMockFileSystem({
      globResults: new Map([['src/**/*.ts', ['src/models/index.ts']]]),
      files: new Set(['src/models/index.ts', 'src/models/schema.ts']),
    });
    const result = await run({ config, fileSystem: fs });
    expect(result).toHaveLength(1);
    expect(result[0].message).toBe('Expected a directory but found a file');
    expect(result[0].conventionName).toBe('conditional-rule');
  });

  it('skips must block when if.hasFile condition is not met', async () => {
    const config: ConfigV1 = {
      version: 'v1',
      conventions: [
        {
          name: 'conditional-rule',
          paths: 'src/**/*.ts',
          must: [
            {
              if: { hasFile: 'schema.ts' },
              must: { haveType: 'directory' },
            },
          ],
        },
      ],
    };
    const fs = createMockFileSystem({
      globResults: new Map([['src/**/*.ts', ['src/models/index.ts']]]),
      files: new Set(['src/models/index.ts']),
    });
    const result = await run({ config, fileSystem: fs });
    expect(result).toEqual([]);
  });

  it('evaluates must block unconditionally when no if is present', async () => {
    const config: ConfigV1 = {
      version: 'v1',
      conventions: [
        {
          name: 'unconditional-rule',
          paths: 'src/**/*.ts',
          must: [{ must: { haveType: 'file' } }],
        },
      ],
    };
    const fs = createMockFileSystem({
      globResults: new Map([['src/**/*.ts', ['src/utils']]]),
      directories: new Set(['src/utils']),
    });
    const result = await run({ config, fileSystem: fs });
    expect(result).toHaveLength(1);
    expect(result[0].message).toBe('Expected a file but found a directory');
  });

  it('supports template expansion in if.hasFile', async () => {
    const config: ConfigV1 = {
      version: 'v1',
      conventions: [
        {
          name: 'template-rule',
          paths: 'src/{name}/index.ts',
          must: [
            {
              if: { hasFile: '${name}.test.ts' },
              must: { haveType: 'directory' },
            },
          ],
        },
      ],
    };
    const fs = createMockFileSystem({
      globResults: new Map([['src/*/index.ts', ['src/utils/index.ts']]]),
      files: new Set(['src/utils/index.ts', 'src/utils/utils.test.ts']),
    });
    const result = await run({ config, fileSystem: fs });
    expect(result).toHaveLength(1);
    expect(result[0].conventionName).toBe('template-rule');
  });

  it('iterates over for.files matches and evaluates predicates', async () => {
    const config: ConfigV1 = {
      version: 'v1',
      conventions: [
        {
          name: 'for-iteration',
          paths: 'components/{name}',
          must: [
            {
              for: { files: '*.test.tsx' },
              must: { haveType: 'file' },
            },
          ],
        },
      ],
    };
    const fs = createMockFileSystem({
      globResults: new Map([
        ['components/*', ['components/Button']],
        ['components/Button/*.test.tsx', ['components/Button/Button.test.tsx']],
      ]),
      directories: new Set(['components/Button']),
      files: new Set(['components/Button/Button.test.tsx']),
    });
    const result = await run({ config, fileSystem: fs });
    expect(result).toEqual([]);
  });

  it('silently skips when for.files matches zero files', async () => {
    const config: ConfigV1 = {
      version: 'v1',
      conventions: [
        {
          name: 'for-skip',
          paths: 'components/{name}',
          must: [
            {
              for: { files: '{storyFile}.stories.tsx' },
              must: { haveType: 'directory' },
            },
          ],
        },
      ],
    };
    const fs = createMockFileSystem({
      globResults: new Map([
        ['components/*', ['components/Input']],
        ['components/Input/*.stories.tsx', []],
      ]),
      directories: new Set(['components/Input']),
    });
    const result = await run({ config, fileSystem: fs });
    expect(result).toEqual([]);
  });

  it('merges placeholders from for.files with parent placeholders', async () => {
    const config: ConfigV1 = {
      version: 'v1',
      conventions: [
        {
          name: 'for-placeholders',
          paths: 'components/{name}',
          must: [
            {
              for: { files: '{storyFile}.stories.tsx' },
              must: { haveType: 'file' },
            },
          ],
        },
      ],
    };
    const fs = createMockFileSystem({
      globResults: new Map([
        ['components/*', ['components/Button']],
        [
          'components/Button/*.stories.tsx',
          ['components/Button/Button.stories.tsx'],
        ],
      ]),
      directories: new Set(['components/Button']),
      files: new Set(['components/Button/Button.stories.tsx']),
    });
    const result = await run({ config, fileSystem: fs });
    expect(result).toEqual([]);
  });

  it('parent placeholder values take precedence over for.files placeholders', async () => {
    const config: ConfigV1 = {
      version: 'v1',
      conventions: [
        {
          name: 'for-parent-precedence',
          paths: 'components/{name}',
          must: [
            {
              for: { files: '{name}.test.tsx' },
              must: { haveType: 'file' },
            },
          ],
        },
      ],
    };
    const fs = createMockFileSystem({
      globResults: new Map([
        ['components/*', ['components/Button']],
        ['components/Button/*.test.tsx', ['components/Button/Button.test.tsx']],
      ]),
      directories: new Set(['components/Button']),
      files: new Set(['components/Button/Button.test.tsx']),
    });
    const result = await run({ config, fileSystem: fs });
    expect(result).toEqual([]);
  });

  it('evaluates if condition before for iteration', async () => {
    const config: ConfigV1 = {
      version: 'v1',
      conventions: [
        {
          name: 'if-and-for',
          paths: 'components/{name}',
          must: [
            {
              if: { hasFile: '${name}.test.tsx' },
              for: { files: '${name}.test.tsx' },
              must: { haveType: 'directory' },
            },
          ],
        },
      ],
    };
    const fsWithCondition = createMockFileSystem({
      globResults: new Map([
        ['components/*', ['components/Button']],
        [
          'components/Button/Button.test.tsx',
          ['components/Button/Button.test.tsx'],
        ],
      ]),
      directories: new Set(['components/Button']),
      files: new Set(['components/Button/Button.test.tsx']),
    });
    const result = await run({ config, fileSystem: fsWithCondition });
    expect(result).toHaveLength(1);
    expect(result[0].message).toBe('Expected a directory but found a file');
  });

  it('skips for block when if condition is not met', async () => {
    const config: ConfigV1 = {
      version: 'v1',
      conventions: [
        {
          name: 'if-and-for-skip',
          paths: 'components/{name}',
          must: [
            {
              if: { hasFile: '${name}.test.tsx' },
              for: { files: '${name}.test.tsx' },
              must: { haveType: 'directory' },
            },
          ],
        },
      ],
    };
    const fs = createMockFileSystem({
      globResults: new Map([['components/*', ['components/Button']]]),
      directories: new Set(['components/Button']),
    });
    const result = await run({ config, fileSystem: fs });
    expect(result).toEqual([]);
  });

  it('evaluates multiple must blocks independently', async () => {
    const config: ConfigV1 = {
      version: 'v1',
      conventions: [
        {
          name: 'multi-block',
          paths: 'src/**/*.ts',
          must: [
            { must: { haveType: 'file' } },
            {
              if: { hasFile: 'missing.ts' },
              must: { haveType: 'directory' },
            },
          ],
        },
      ],
    };
    const fs = createMockFileSystem({
      globResults: new Map([['src/**/*.ts', ['src/a.ts']]]),
      files: new Set(['src/a.ts']),
    });
    const result = await run({ config, fileSystem: fs });
    expect(result).toEqual([]);
  });
});

describe('caching behavior', () => {
  it('parses the same file only once across multiple conventions', async () => {
    const readFileSpy = vi.fn().mockReturnValue('export const x = 1;');
    const fs: FileSystem = {
      glob: vi.fn((patterns: string[]) => {
        const key = patterns.sort().join(',');
        const results = new Map<string, string[]>([
          ['src/shared.ts', ['src/shared.ts']],
        ]);
        return Promise.resolve(results.get(key) ?? []);
      }),
      isDirectory: () => false,
      isFile: (p: string) => p === 'src/shared.ts',
      fileExists: (p: string) => p === 'src/shared.ts',
      readDir: () => [],
      readFile: readFileSpy,
    };
    const config: ConfigV1 = {
      version: 'v1',
      conventions: [
        {
          name: 'convention-a',
          paths: 'src/shared.ts',
          must: { export: [{ name: 'x' }] },
        },
        {
          name: 'convention-b',
          paths: 'src/shared.ts',
          must: { export: [{ name: 'x' }] },
        },
      ],
    };
    await run({ config, fileSystem: fs });
    expect(readFileSpy).toHaveBeenCalledTimes(1);
  });

  it('parses the same file only once when referenced in for blocks', async () => {
    const readFileSpy = vi.fn().mockReturnValue('export const x = 1;');
    const fs: FileSystem = {
      glob: vi.fn((patterns: string[]) => {
        const key = patterns.sort().join(',');
        const results = new Map<string, string[]>([
          ['components/*', ['components/Button']],
          ['components/Button/*.ts', ['components/Button/shared.ts']],
        ]);
        return Promise.resolve(results.get(key) ?? []);
      }),
      isDirectory: (p: string) => p === 'components/Button',
      isFile: (p: string) => p === 'components/Button/shared.ts',
      fileExists: (p: string) =>
        p === 'components/Button' || p === 'components/Button/shared.ts',
      readDir: () => [],
      readFile: readFileSpy,
    };
    const config: ConfigV1 = {
      version: 'v1',
      conventions: [
        {
          name: 'convention-a',
          paths: 'components/{name}',
          must: [
            {
              for: { files: '*.ts' },
              must: { export: [{ name: 'x' }] },
            },
            {
              for: { files: '*.ts' },
              must: { export: [{ name: 'x' }] },
            },
          ],
        },
      ],
    };
    await run({ config, fileSystem: fs });
    expect(readFileSpy).toHaveBeenCalledTimes(1);
  });
});
