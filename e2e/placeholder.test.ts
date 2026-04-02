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
