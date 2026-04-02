import { runCommand } from 'citty';
import { describe, expect, it, vi } from 'vitest';
import checkCommand from './check.js';
import validateCommand from './validate.js';
import versionCommand from './version.js';

describe('check command', () => {
  it('runs without error', async () => {
    await expect(
      runCommand(checkCommand, { rawArgs: [] })
    ).resolves.not.toThrow();
  });
});

describe('validate command', () => {
  it('runs without error', async () => {
    await expect(
      runCommand(validateCommand, { rawArgs: [] })
    ).resolves.not.toThrow();
  });
});

describe('version command', () => {
  it('prints the version to stdout', async () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(vi.fn());
    await runCommand(versionCommand, { rawArgs: [] });
    expect(logSpy).toHaveBeenCalledWith('0.0.0');
    logSpy.mockRestore();
  });
});
