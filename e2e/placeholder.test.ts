import { execFile as execFileCb } from 'node:child_process';
import { resolve } from 'node:path';
import { promisify } from 'node:util';
import { describe, expect, it } from 'vitest';

const execFile = promisify(execFileCb);

const cliBinary = resolve(
  import.meta.dirname,
  '../packages/konsistent/dist/index.js'
);

describe('CLI binary', () => {
  it('exits 0 with no arguments (default check)', async () => {
    const { stdout } = await execFile('node', [cliBinary]);
    expect(stdout).toBeDefined();
  });

  it('konsistent check exits 0', async () => {
    const { stdout } = await execFile('node', [cliBinary, 'check']);
    expect(stdout).toBeDefined();
  });

  it('konsistent validate exits 0', async () => {
    const { stdout } = await execFile('node', [cliBinary, 'validate']);
    expect(stdout).toBeDefined();
  });

  it('konsistent version prints the version', async () => {
    const { stdout } = await execFile('node', [cliBinary, 'version']);
    expect(stdout.trim()).toBe('0.0.0');
  });

  it('konsistent --version prints the version', async () => {
    const { stdout } = await execFile('node', [cliBinary, '--version']);
    expect(stdout.trim()).toBe('0.0.0');
  });
});
