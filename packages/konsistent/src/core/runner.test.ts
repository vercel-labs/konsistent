import { describe, expect, it } from 'vitest';
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
});
