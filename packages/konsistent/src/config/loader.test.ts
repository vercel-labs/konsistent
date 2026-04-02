import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { loadConfig } from './loader.js';

const fixturesDir = resolve(import.meta.dirname, '../../../../e2e/fixtures');

describe('loadConfig', () => {
  it('loads a valid empty-config fixture', async () => {
    const result = await loadConfig({
      configPath: resolve(fixturesDir, 'empty-config/konsistent.json'),
    });
    expect('config' in result).toBe(true);
    if ('config' in result) {
      expect(result.config.version).toBe('v1');
      expect(result.config.conventions).toEqual([]);
    }
  });

  it('returns error for invalid-config fixture', async () => {
    const result = await loadConfig({
      configPath: resolve(fixturesDir, 'invalid-config/konsistent.json'),
    });
    expect('error' in result).toBe(true);
  });

  it('returns error when config file does not exist', async () => {
    const result = await loadConfig({
      configPath: '/nonexistent/path/konsistent.json',
    });
    expect('error' in result).toBe(true);
    if ('error' in result) {
      expect(result.error).toContain('Could not read config file');
    }
  });

  it('returns error for invalid JSON', async () => {
    const result = await loadConfig({
      configPath: resolve(import.meta.dirname, 'schema.ts'),
    });
    expect('error' in result).toBe(true);
    if ('error' in result) {
      expect(result.error).toContain('Invalid JSON');
    }
  });
});
