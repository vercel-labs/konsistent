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

const githubAnnotationPattern = /^::error file=.+::.+/;
// biome-ignore lint/suspicious/noControlCharactersInRegex: checking for ANSI escape codes
const ansiEscapePattern = /\x1b\[/;
const summaryPattern = /Checked \d+ files? in \d+(ms|\.\d+s)\./;

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
      expect(error.stdout).toContain('must-export-activate-and-more');
      expect(error.stdout).toContain('Missing export "deactivate"');
      expect(error.stdout).toContain('Missing export constant "pluginId"');
      expect(error.stdout).toContain('Found 4 violations.');
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
      expect(error.stdout).toContain('Found 4 violations.');
    }
  });
});

describe('function-signatures fixture', () => {
  const cwd = resolve(fixturesDir, 'function-signatures');

  it('konsistent check exits 0 when all conventions pass', async () => {
    await expect(runCli({ args: ['check'], cwd })).resolves.not.toThrow();
  });
});

describe('function-signatures-broken fixture', () => {
  const cwd = resolve(fixturesDir, 'function-signatures-broken');

  it('konsistent check exits 1 with function signature violations', async () => {
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
        'Function "createAuthService" must receive a parameter of type "AuthConfig"'
      );
      expect(error.stdout).toContain(
        'Function "createPaymentsService" must return value of type "PaymentsService"'
      );
      expect(error.stdout).toContain('must-export-create-service-function');
      expect(error.stdout).toContain('Found 2 violations.');
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
      expect(error.stdout).toContain('must-export-and-more');
      expect(error.stdout).toContain('Found 3 violations.');
    }
  });
});

describe('ai-toolkit-broken-interfaces fixture --format github', () => {
  const cwd = resolve(fixturesDir, 'ai-toolkit-broken-interfaces');

  it('konsistent check --format github outputs ::error annotations', async () => {
    try {
      await runCli({ args: ['check', '--format', 'github'], cwd });
      expect.fail('Expected check to exit with code 1');
    } catch (err: unknown) {
      const error = err as {
        stdout: string;
        stderr: string;
        code: number;
        status: number;
      };
      expect(error.code ?? error.status).toBe(1);
      const lines = error.stdout.trim().split('\n');
      for (const line of lines) {
        expect(line).toMatch(githubAnnotationPattern);
      }
      expect(error.stdout).toContain('::error file=');
      expect(error.stdout).toContain(
        'Interface "OpenaiProvider" must extend "ProviderV1"'
      );
      expect(error.stdout).toContain(',title=provider-interface');
      expect(error.stdout).toContain(',line=');
      expect(error.stdout).not.toContain('Found');
      expect(error.stdout).not.toContain('column=');
    }
  });
});

describe('class-and-function-contracts fixture', () => {
  const cwd = resolve(fixturesDir, 'class-and-function-contracts');

  it('konsistent check exits 0 when all conventions pass', async () => {
    await expect(runCli({ args: ['check'], cwd })).resolves.not.toThrow();
  });
});

describe('class-and-function-contracts-broken fixture', () => {
  const cwd = resolve(fixturesDir, 'class-and-function-contracts-broken');

  it('konsistent check exits 1 with class and function contract violations', async () => {
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
        'Class "CacheAdapter" must extend "BaseAdapter"'
      );
      expect(error.stdout).toContain('Missing import type "BaseAdapter"');
      expect(error.stdout).toContain(
        'Class "DatabaseAdapter" must extend "BaseAdapter"'
      );
      expect(error.stdout).toContain(
        'Function "createDatabaseAdapter" must receive a parameter of type "DatabaseAdapterConfig"'
      );
      expect(error.stdout).toContain(
        'Function "createDatabaseAdapter" must return value of type "DatabaseAdapter"'
      );
      expect(error.stdout).toContain('must-export-adapter-class-and-more');
      expect(error.stdout).toContain('Found 5 violations.');
    }
  });
});

describe('component-library fixture', () => {
  const cwd = resolve(fixturesDir, 'component-library');

  it('konsistent check exits 0 when all conventions pass', async () => {
    await expect(runCli({ args: ['check'], cwd })).resolves.not.toThrow();
  });
});

describe('component-library-broken-conditionals fixture', () => {
  const cwd = resolve(fixturesDir, 'component-library-broken-conditionals');

  it('konsistent check exits 1 with export and export constant violations', async () => {
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
      expect(error.stdout).toContain('Missing export "describe"');
      expect(error.stdout).toContain('Missing export constant "meta"');
      expect(error.stdout).toContain('must-have-tsx');
      expect(error.stdout).toContain('Found 2 violations.');
    }
  });
});

describe('monorepo-with-negation fixture', () => {
  const cwd = resolve(fixturesDir, 'monorepo-with-negation');

  it('konsistent check exits 0 when negation excludes test-utils', async () => {
    await expect(runCli({ args: ['check'], cwd })).resolves.not.toThrow();
  });
});

describe('ai-toolkit-broken-exports fixture --format markdown', () => {
  const cwd = resolve(fixturesDir, 'ai-toolkit-broken-exports');

  it('konsistent check --format markdown outputs Markdown table structure', async () => {
    try {
      await runCli({ args: ['check', '--format', 'markdown'], cwd });
      expect.fail('Expected check to exit with code 1');
    } catch (err: unknown) {
      const error = err as {
        stdout: string;
        stderr: string;
        code: number;
        status: number;
      };
      expect(error.code ?? error.status).toBe(1);
      const output = error.stdout.trim();
      expect(output).toContain('**`packages/');
      expect(output).toContain('| Line | Severity | Message | Convention |');
      expect(output).toContain('|------|----------|---------|------------|');
      expect(output).toContain('| - | error | Missing export "openai" |');
      expect(output).toContain('Found 3 violations.**');
      expect(output).not.toMatch(ansiEscapePattern);
    }
  });
});

describe('monorepo-with-negation-broken fixture', () => {
  const cwd = resolve(fixturesDir, 'monorepo-with-negation-broken');

  it('konsistent check exits 1 with missing export violation', async () => {
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
      expect(error.stdout).toContain('Missing export "cli"');
      expect(error.stdout).toContain('Found 1 violation.');
    }
  });

  it('konsistent check --format json outputs valid JSON with expected diagnostics', async () => {
    try {
      await runCli({ args: ['check', '--format', 'json'], cwd });
      expect.fail('Expected check to exit with code 1');
    } catch (err: unknown) {
      const error = err as {
        stdout: string;
        stderr: string;
        code: number;
        status: number;
      };
      expect(error.code ?? error.status).toBe(1);
      const parsed = JSON.parse(error.stdout.trim());
      expect(Array.isArray(parsed)).toBe(true);
      expect(parsed).toHaveLength(1);
      expect(parsed[0]).toMatchObject({
        severity: 'error',
        conventionName: 'package-barrel-exports',
        predicateName: 'export',
        message: 'Missing export "cli"',
      });
      expect(parsed[0].filePath).toContain('packages/cli/src/index.ts');
      expect(parsed[0]).not.toHaveProperty('column');
    }
  });
});

describe('summary output', () => {
  it('shows summary with timing on clean runs', async () => {
    const cwd = resolve(fixturesDir, 'empty-config');
    const { stdout } = await runCli({ args: ['check'], cwd });
    expect(stdout).toMatch(summaryPattern);
    expect(stdout).toContain('No violations found.');
  });

  it('shows summary with timing on violation runs', async () => {
    const cwd = resolve(fixturesDir, 'monorepo-with-negation-broken');
    try {
      await runCli({ args: ['check'], cwd });
      expect.fail('Expected check to exit with code 1');
    } catch (err: unknown) {
      const error = err as { stdout: string; code: number; status: number };
      expect(error.code ?? error.status).toBe(1);
      expect(error.stdout).toMatch(summaryPattern);
      expect(error.stdout).toContain('Found 1 violation.');
    }
  });
});

describe('--config-path flag', () => {
  it('loads config from a custom path', async () => {
    const configPath = resolve(fixturesDir, 'empty-config/konsistent.json');
    const cwd = resolve(fixturesDir, 'empty-config');
    await expect(
      runCli({ args: ['check', '--config-path', configPath], cwd })
    ).resolves.not.toThrow();
  });

  it('loads config from a custom path for validate', async () => {
    const configPath = resolve(fixturesDir, 'empty-config/konsistent.json');
    const { stdout } = await runCli({
      args: ['validate', '--config-path', configPath],
      cwd: fixturesDir,
    });
    expect(stdout).toContain('Configuration is valid');
  });

  it('exits 1 with error when config-path does not exist', async () => {
    try {
      await runCli({
        args: ['check', '--config-path', '/nonexistent/konsistent.json'],
        cwd: fixturesDir,
      });
      expect.fail('Expected check to exit with code 1');
    } catch (err: unknown) {
      const error = err as { stderr: string; code: number; status: number };
      expect(error.code ?? error.status).toBe(1);
      expect(error.stderr).toContain('Could not read config file');
    }
  });
});

describe('--colors flag', () => {
  const cwd = resolve(fixturesDir, 'plugin-system-broken-files');

  it('--colors=false strips ANSI escape codes from default output', async () => {
    try {
      await runCli({ args: ['check', '--colors', 'false'], cwd });
      expect.fail('Expected check to exit with code 1');
    } catch (err: unknown) {
      const error = err as {
        stdout: string;
        stderr: string;
        code: number;
        status: number;
      };
      expect(error.code ?? error.status).toBe(1);
      expect(error.stdout.includes('\x1b[')).toBe(false);
      expect(error.stdout).toContain('Missing required file');
    }
  });
});

describe('--max-diagnostics flag', () => {
  const cwd = resolve(fixturesDir, 'class-and-function-contracts-broken');

  it('truncates output when --max-diagnostics is less than total violations', async () => {
    try {
      await runCli({ args: ['check', '--max-diagnostics', '1'], cwd });
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
        '... and 4 more diagnostics (use --max-diagnostics to see more)'
      );
    }
  });

  it('shows summary line together with truncation message', async () => {
    try {
      await runCli({ args: ['check', '--max-diagnostics', '1'], cwd });
      expect.fail('Expected check to exit with code 1');
    } catch (err: unknown) {
      const error = err as {
        stdout: string;
        stderr: string;
        code: number;
        status: number;
      };
      expect(error.code ?? error.status).toBe(1);
      expect(error.stdout).toContain('... and 4 more diagnostics');
      expect(error.stdout).toMatch(summaryPattern);
    }
  });
});
