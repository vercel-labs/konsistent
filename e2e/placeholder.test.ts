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
  it('exits with code 0 and prints "konsistent"', async () => {
    const { stdout } = await execFile('node', [cliBinary]);
    expect(stdout).toContain('konsistent');
  });
});
