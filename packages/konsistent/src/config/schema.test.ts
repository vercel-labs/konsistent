import { describe, expect, it } from 'vitest';
import { ConfigV1Schema } from './schema.js';

describe('ConfigV1Schema', () => {
  it('accepts a minimal valid config with empty conventions', () => {
    const result = ConfigV1Schema.safeParse({
      version: 'v1',
      conventions: [],
    });
    expect(result.success).toBe(true);
  });

  it('accepts a config with $schema field', () => {
    const result = ConfigV1Schema.safeParse({
      $schema: 'https://example.com/schema.json',
      version: 'v1',
      conventions: [],
    });
    expect(result.success).toBe(true);
  });

  it('accepts a convention with haveType predicate', () => {
    const result = ConfigV1Schema.safeParse({
      version: 'v1',
      conventions: [
        {
          name: 'components-are-files',
          paths: 'src/components/*.ts',
          must: { haveType: 'file' },
        },
      ],
    });
    expect(result.success).toBe(true);
  });

  it('accepts a convention with paths as array', () => {
    const result = ConfigV1Schema.safeParse({
      version: 'v1',
      conventions: [
        {
          paths: ['src/*.ts', 'lib/*.ts'],
          must: {},
        },
      ],
    });
    expect(result.success).toBe(true);
  });

  it('accepts a convention with all optional fields', () => {
    const result = ConfigV1Schema.safeParse({
      version: 'v1',
      conventions: [
        {
          name: 'my-rule',
          description: 'A test rule',
          paths: 'src/*.ts',
          must: { haveType: 'directory' },
        },
      ],
    });
    expect(result.success).toBe(true);
  });

  it('rejects config with missing version', () => {
    const result = ConfigV1Schema.safeParse({
      conventions: [],
    });
    expect(result.success).toBe(false);
  });

  it('rejects config with wrong version', () => {
    const result = ConfigV1Schema.safeParse({
      version: 'v2',
      conventions: [],
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const versionIssue = result.error.issues.find((i) =>
        i.path.includes('version')
      );
      expect(versionIssue).toBeDefined();
    }
  });

  it('rejects config with wrong haveType value', () => {
    const result = ConfigV1Schema.safeParse({
      version: 'v1',
      conventions: [
        {
          paths: 'src/*.ts',
          must: { haveType: 'symlink' },
        },
      ],
    });
    expect(result.success).toBe(false);
  });

  it('rejects convention with invalid name pattern', () => {
    const result = ConfigV1Schema.safeParse({
      version: 'v1',
      conventions: [
        {
          name: 'Invalid Name!',
          paths: 'src/*.ts',
          must: {},
        },
      ],
    });
    expect(result.success).toBe(false);
  });

  it('passes through unknown predicates in must', () => {
    const result = ConfigV1Schema.safeParse({
      version: 'v1',
      conventions: [
        {
          paths: 'src/*.ts',
          must: { unknownPredicate: ['foo'] },
        },
      ],
    });
    expect(result.success).toBe(true);
  });

  it('accepts must as an array of MustBlocks', () => {
    const result = ConfigV1Schema.safeParse({
      version: 'v1',
      conventions: [
        {
          paths: 'src/*.ts',
          must: [
            { must: { haveType: 'file' } },
            { if: { hasFile: 'index.ts' }, must: { haveType: 'file' } },
          ],
        },
      ],
    });
    expect(result.success).toBe(true);
  });

  it('accepts a MustBlock without if condition', () => {
    const result = ConfigV1Schema.safeParse({
      version: 'v1',
      conventions: [
        {
          paths: 'src/*.ts',
          must: [{ must: { haveType: 'file' } }],
        },
      ],
    });
    expect(result.success).toBe(true);
  });

  it('rejects a MustBlock array with missing must property', () => {
    const result = ConfigV1Schema.safeParse({
      version: 'v1',
      conventions: [
        {
          paths: 'src/*.ts',
          must: [{ if: { hasFile: 'index.ts' } }],
        },
      ],
    });
    expect(result.success).toBe(false);
  });
});
