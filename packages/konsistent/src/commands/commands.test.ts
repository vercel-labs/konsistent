import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { runCommand } from 'citty';
import { afterEach, describe, expect, it, vi } from 'vitest';

const require = createRequire(import.meta.url);
const pkg = require('../../package.json') as { version: string };
import checkCommand, { resolveFormat } from './check.js';
import helpCommand from './help.js';
import validateCommand from './validate.js';
import versionCommand from './version.js';

const emptyConfigPath = resolve(
  import.meta.dirname,
  '../../../../e2e/fixtures/empty-config'
);

const warningsOnlyPath = resolve(
  import.meta.dirname,
  '../../../../e2e/fixtures/warnings-only'
);

const mixedSeverityPath = resolve(
  import.meta.dirname,
  '../../../../e2e/fixtures/mixed-severity'
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

describe('check command --error-on-warnings', () => {
  it('exits 1 when warnings exist and flag is set', async () => {
    vi.spyOn(process, 'cwd').mockReturnValue(warningsOnlyPath);
    const exitSpy = vi
      .spyOn(process, 'exit')
      .mockImplementation(() => undefined as never);
    vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    await runCommand(checkCommand, { rawArgs: ['--error-on-warnings'] });
    expect(exitSpy).toHaveBeenCalledWith(1);
  });

  it('exits 0 when no diagnostics and flag is set', async () => {
    vi.spyOn(process, 'cwd').mockReturnValue(emptyConfigPath);
    const exitSpy = vi
      .spyOn(process, 'exit')
      .mockImplementation(() => undefined as never);
    await runCommand(checkCommand, { rawArgs: ['--error-on-warnings'] });
    expect(exitSpy).not.toHaveBeenCalled();
  });
});

describe('check command --diagnostic-level', () => {
  it('skips warning conventions when set to error', async () => {
    vi.spyOn(process, 'cwd').mockReturnValue(warningsOnlyPath);
    const exitSpy = vi
      .spyOn(process, 'exit')
      .mockImplementation(() => undefined as never);
    const writeSpy = vi
      .spyOn(process.stdout, 'write')
      .mockImplementation(() => true);
    await runCommand(checkCommand, {
      rawArgs: ['--diagnostic-level', 'error'],
    });
    expect(exitSpy).not.toHaveBeenCalled();
    const output = writeSpy.mock.calls.map((c) => c[0]).join('');
    expect(output).not.toContain('warning');
  });

  it('evaluates warning conventions when set to warning', async () => {
    vi.spyOn(process, 'cwd').mockReturnValue(warningsOnlyPath);
    const exitSpy = vi
      .spyOn(process, 'exit')
      .mockImplementation(() => undefined as never);
    const writeSpy = vi
      .spyOn(process.stdout, 'write')
      .mockImplementation(() => true);
    await runCommand(checkCommand, {
      rawArgs: ['--diagnostic-level', 'warning'],
    });
    expect(exitSpy).not.toHaveBeenCalled();
    const output = writeSpy.mock.calls.map((c) => c[0]).join('');
    expect(output).toContain('warning');
  });

  it('still reports errors when set to error', async () => {
    vi.spyOn(process, 'cwd').mockReturnValue(mixedSeverityPath);
    const exitSpy = vi
      .spyOn(process, 'exit')
      .mockImplementation(() => undefined as never);
    const writeSpy = vi
      .spyOn(process.stdout, 'write')
      .mockImplementation(() => true);
    await runCommand(checkCommand, {
      rawArgs: ['--diagnostic-level', 'error'],
    });
    expect(exitSpy).toHaveBeenCalledWith(1);
    const output = writeSpy.mock.calls.map((c) => c[0]).join('');
    expect(output).toContain('error');
    expect(output).not.toContain('warning');
  });

  it('defaults to warning when not specified', async () => {
    vi.spyOn(process, 'cwd').mockReturnValue(warningsOnlyPath);
    const exitSpy = vi
      .spyOn(process, 'exit')
      .mockImplementation(() => undefined as never);
    const writeSpy = vi
      .spyOn(process.stdout, 'write')
      .mockImplementation(() => true);
    await runCommand(checkCommand, { rawArgs: [] });
    expect(exitSpy).not.toHaveBeenCalled();
    const output = writeSpy.mock.calls.map((c) => c[0]).join('');
    expect(output).toContain('warning');
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
    expect(logSpy).toHaveBeenCalledWith(pkg.version);
  });
});
