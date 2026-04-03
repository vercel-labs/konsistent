import { resolve } from 'node:path';
import { runCommand } from 'citty';
import { afterEach, describe, expect, it, vi } from 'vitest';
import checkCommand, { resolveFormat } from './check.js';
import helpCommand from './help.js';
import validateCommand from './validate.js';
import versionCommand from './version.js';

const emptyConfigPath = resolve(
  import.meta.dirname,
  '../../../../e2e/fixtures/empty-config'
);

afterEach(() => {
  vi.restoreAllMocks();
});

describe('check command', () => {
  it('runs without error on valid config', async () => {
    vi.spyOn(process, 'cwd').mockReturnValue(emptyConfigPath);
    await expect(
      runCommand(checkCommand, { rawArgs: [] })
    ).resolves.not.toThrow();
  });
});

describe('validate command', () => {
  it('runs without error on valid config', async () => {
    vi.spyOn(process, 'cwd').mockReturnValue(emptyConfigPath);
    const logSpy = vi.spyOn(console, 'log').mockImplementation(vi.fn());
    await runCommand(validateCommand, { rawArgs: [] });
    expect(logSpy).toHaveBeenCalled();
  });
});

describe('resolveFormat', () => {
  it('returns explicit format when not default', () => {
    expect(resolveFormat({ format: 'json' })).toBe('json');
    expect(resolveFormat({ format: 'github' })).toBe('github');
    expect(resolveFormat({ format: 'markdown' })).toBe('markdown');
  });

  it('returns github when GITHUB_ACTIONS is true and format is default', () => {
    process.env.GITHUB_ACTIONS = 'true';
    expect(resolveFormat({ format: 'default' })).toBe('github');
    process.env.GITHUB_ACTIONS = undefined;
  });

  it('returns default when GITHUB_ACTIONS is not set', () => {
    process.env.GITHUB_ACTIONS = undefined;
    expect(resolveFormat({ format: 'default' })).toBe('default');
  });
});

describe('help command', () => {
  it('prints help text to stdout', async () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(vi.fn());
    await runCommand(helpCommand, { rawArgs: [] });
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('Usage:'));
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('check'));
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('validate'));
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('version'));
  });
});

describe('version command', () => {
  it('prints the version to stdout', async () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(vi.fn());
    await runCommand(versionCommand, { rawArgs: [] });
    expect(logSpy).toHaveBeenCalledWith('0.0.0');
  });
});
