import { execFile as execFileCb } from 'node:child_process';
import { resolve } from 'node:path';
import { promisify } from 'node:util';
import { describe, expect, it } from 'vitest';

const execFile = promisify(execFileCb);

const cliBinary = resolve(
  import.meta.dirname,
  '../packages/konsistent/dist/index.js'
);

const fixturesDir = resolve(import.meta.dirname, 'fixtures');

function runCli(opts: { args?: string[]; cwd?: string }) {
  return execFile('node', [cliBinary, ...(opts.args ?? [])], {
    cwd: opts.cwd,
  });
}

describe('CLI binary', () => {
  it('konsistent version prints the version', async () => {
    const { stdout } = await runCli({ args: ['version'] });
    expect(stdout.trim()).toBe('0.0.0');
  });

  it('konsistent --version prints the version', async () => {
    const { stdout } = await runCli({ args: ['--version'] });
    expect(stdout.trim()).toBe('0.0.0');
  });
});

describe('empty-config fixture', () => {
  const cwd = resolve(fixturesDir, 'empty-config');

  it('konsistent validate exits 0', async () => {
    const { stdout } = await runCli({ args: ['validate'], cwd });
    expect(stdout).toContain('Configuration is valid');
  });

  it('konsistent check exits 0', async () => {
    await expect(runCli({ args: ['check'], cwd })).resolves.not.toThrow();
  });

  it('default command (no args) exits 0', async () => {
    await expect(runCli({ cwd })).resolves.not.toThrow();
  });
});

describe('invalid-config fixture', () => {
  const cwd = resolve(fixturesDir, 'invalid-config');

  it('konsistent validate exits 1', async () => {
    await expect(runCli({ args: ['validate'], cwd })).rejects.toThrow();
  });

  it('konsistent check exits 1', async () => {
    await expect(runCli({ args: ['check'], cwd })).rejects.toThrow();
  });
});

describe('plugin-system fixture', () => {
  const cwd = resolve(fixturesDir, 'plugin-system');

  it('konsistent check exits 0 when all conventions pass', async () => {
    await expect(runCli({ args: ['check'], cwd })).resolves.not.toThrow();
  });
});

describe('plugin-system-broken-files fixture', () => {
  const cwd = resolve(fixturesDir, 'plugin-system-broken-files');

  it('konsistent check exits 1 with missing file violations', async () => {
    try {
      await runCli({ args: ['check'], cwd });
      expect.fail('Expected check to exit with code 1');
    } catch (err: unknown) {
      const error = err as {
        stdout: string;
        stderr: string;
        code: number;
        status: number;
      };
      expect(error.code ?? error.status).toBe(1);
      expect(error.stdout).toContain('Missing required file');
      expect(error.stdout).toContain('README.md');
      expect(error.stdout).toContain('manifest.json');
      expect(error.stdout).toContain('plugin-directories');
      expect(error.stdout).toContain('Missing export "deactivate"');
      expect(error.stdout).toContain('Missing export constant "pluginId"');
      expect(error.stdout).toContain('Found 4 problems (4 errors)');
    }
  });
});

describe('ai-toolkit fixture', () => {
  const cwd = resolve(fixturesDir, 'ai-toolkit');

  it('konsistent check exits 0 when all conventions pass', async () => {
    await expect(runCli({ args: ['check'], cwd })).resolves.not.toThrow();
  });
});

describe('ai-toolkit-broken-interfaces fixture', () => {
  const cwd = resolve(fixturesDir, 'ai-toolkit-broken-interfaces');

  it('konsistent check exits 1 with interface and import violations', async () => {
    try {
      await runCli({ args: ['check'], cwd });
      expect.fail('Expected check to exit with code 1');
    } catch (err: unknown) {
      const error = err as {
        stdout: string;
        stderr: string;
        code: number;
        status: number;
      };
      expect(error.code ?? error.status).toBe(1);
      expect(error.stdout).toContain(
        'Interface "OpenaiProvider" must extend "ProviderV1"'
      );
      expect(error.stdout).toContain(
        'Missing export interface "AnthropicProvider"'
      );
      expect(error.stdout).toContain('Missing import type "ProviderV1"');
      expect(error.stdout).toContain('Found 4 problems (4 errors)');
    }
  });
});

describe('ai-toolkit-broken-exports fixture', () => {
  const cwd = resolve(fixturesDir, 'ai-toolkit-broken-exports');

  it('konsistent check exits 1 with export violations', async () => {
    try {
      await runCli({ args: ['check'], cwd });
      expect.fail('Expected check to exit with code 1');
    } catch (err: unknown) {
      const error = err as {
        stdout: string;
        stderr: string;
        code: number;
        status: number;
      };
      expect(error.code ?? error.status).toBe(1);
      expect(error.stdout).toContain('Missing export "openai"');
      expect(error.stdout).toContain(
        'Missing export type "OpenaiProviderSettings"'
      );
      expect(error.stdout).toContain('Missing export type "AnthropicProvider"');
      expect(error.stdout).toContain('Found 3 problems (3 errors)');
    }
  });
});
