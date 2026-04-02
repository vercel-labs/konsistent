import { resolve } from 'node:path';
import { runCommand } from 'citty';
import { afterEach, describe, expect, it, vi } from 'vitest';
import checkCommand from './check.js';
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

describe('version command', () => {
  it('prints the version to stdout', async () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(vi.fn());
    await runCommand(versionCommand, { rawArgs: [] });
    expect(logSpy).toHaveBeenCalledWith('0.0.0');
  });
});
