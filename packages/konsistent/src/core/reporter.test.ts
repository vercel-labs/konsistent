import pc from 'picocolors';
import { describe, expect, it } from 'vitest';
import type { Diagnostic } from './diagnostics.js';
import {
  createDefaultReporter,
  createGithubReporter,
  createJsonReporter,
  createMarkdownReporter,
} from './reporter.js';
import type { RunResult } from './runner.js';

function makeResult(opts: {
  diagnostics: Diagnostic[];
  filesChecked?: number;
  elapsed?: number;
}): RunResult {
  return {
    diagnostics: opts.diagnostics,
    filesChecked: opts.filesChecked ?? 1,
    elapsed: opts.elapsed ?? 5,
  };
}

describe('createDefaultReporter', () => {
  const reporter = createDefaultReporter();

  it('returns summary for no diagnostics', () => {
    const output = reporter.format(
      makeResult({ diagnostics: [], filesChecked: 3, elapsed: 5 })
    );
    expect(output).toContain('Checked 3 files in 5ms.');
    expect(output).toContain('No violations found.');
  });

  it('formats diagnostics grouped by file', () => {
    const diagnostics: Diagnostic[] = [
      {
        severity: 'error',
        filePath: 'src/foo.ts',
        predicateName: 'haveType',
        message: 'Expected a file but found a directory',
      },
      {
        severity: 'error',
        filePath: 'src/foo.ts',
        predicateName: 'haveType',
        message: 'Another issue',
      },
      {
        severity: 'error',
        filePath: 'src/bar.ts',
        predicateName: 'haveType',
        message: 'Expected a directory',
      },
    ];
    const output = reporter.format(
      makeResult({ diagnostics, filesChecked: 2, elapsed: 10 })
    );
    expect(output).toContain(pc.bold('src/foo.ts'));
    expect(output).toContain(pc.bold('src/bar.ts'));
    expect(output).toContain('Expected a file but found a directory');
    expect(output).toContain('Checked 2 files in 10ms. Found 3 violations.');
  });

  it('uses dash for line number when line is undefined', () => {
    const diagnostics: Diagnostic[] = [
      {
        severity: 'error',
        filePath: 'src/foo.ts',
        predicateName: 'haveType',
        message: 'test message',
      },
    ];
    const output = reporter.format(makeResult({ diagnostics }));
    expect(output).toContain(`  -  ${pc.red('error')}  test message`);
  });

  it('uses line number when provided', () => {
    const diagnostics: Diagnostic[] = [
      {
        severity: 'error',
        filePath: 'src/foo.ts',
        predicateName: 'haveType',
        message: 'test message',
        line: 42,
      },
    ];
    const output = reporter.format(makeResult({ diagnostics }));
    expect(output).toContain(`  42  ${pc.red('error')}  test message`);
  });

  it('shows convention name in dim when present', () => {
    const diagnostics: Diagnostic[] = [
      {
        severity: 'error',
        filePath: 'src/foo.ts',
        predicateName: 'haveType',
        message: 'Missing export',
        conventionName: 'provider-packages',
      },
    ];
    const output = reporter.format(makeResult({ diagnostics }));
    expect(output).toContain(
      `Missing export  ${pc.dim('[provider-packages]')}`
    );
  });

  it('omits convention name bracket when conventionName is absent', () => {
    const diagnostics: Diagnostic[] = [
      {
        severity: 'error',
        filePath: 'src/foo.ts',
        predicateName: 'haveType',
        message: 'Some problem',
      },
    ];
    const output = reporter.format(makeResult({ diagnostics }));
    const diagLine = output.split('\n').find((l) => l.includes('Some problem'));
    expect(diagLine).toBeDefined();
    expect(diagLine).not.toContain('[');
  });

  it('sorts file-level violations before line-specific ones', () => {
    const diagnostics: Diagnostic[] = [
      {
        severity: 'error',
        filePath: 'src/foo.ts',
        predicateName: 'haveType',
        message: 'line 10 issue',
        line: 10,
      },
      {
        severity: 'error',
        filePath: 'src/foo.ts',
        predicateName: 'haveType',
        message: 'file-level issue',
      },
      {
        severity: 'error',
        filePath: 'src/foo.ts',
        predicateName: 'haveType',
        message: 'line 5 issue',
        line: 5,
      },
    ];
    const output = reporter.format(makeResult({ diagnostics }));
    const diagLines = output.split('\n').filter((l) => l.includes('issue'));
    expect(diagLines[0]).toContain('file-level issue');
    expect(diagLines[1]).toContain('line 5 issue');
    expect(diagLines[2]).toContain('line 10 issue');
  });

  it('right-aligns line numbers to widest in group', () => {
    const diagnostics: Diagnostic[] = [
      {
        severity: 'error',
        filePath: 'src/foo.ts',
        predicateName: 'haveType',
        message: 'issue at 5',
        line: 5,
      },
      {
        severity: 'error',
        filePath: 'src/foo.ts',
        predicateName: 'haveType',
        message: 'issue at 100',
        line: 100,
      },
    ];
    const output = reporter.format(makeResult({ diagnostics }));
    expect(output).toContain(`    5  ${pc.red('error')}  issue at 5`);
    expect(output).toContain(`  100  ${pc.red('error')}  issue at 100`);
  });

  it('pads dash to match widest line number width', () => {
    const diagnostics: Diagnostic[] = [
      {
        severity: 'error',
        filePath: 'src/foo.ts',
        predicateName: 'haveType',
        message: 'file-level',
      },
      {
        severity: 'error',
        filePath: 'src/foo.ts',
        predicateName: 'haveType',
        message: 'at line 999',
        line: 999,
      },
    ];
    const output = reporter.format(makeResult({ diagnostics }));
    expect(output).toContain(`    -  ${pc.red('error')}  file-level`);
    expect(output).toContain(`  999  ${pc.red('error')}  at line 999`);
  });

  it('separates file groups with blank lines', () => {
    const diagnostics: Diagnostic[] = [
      {
        severity: 'error',
        filePath: 'src/a.ts',
        predicateName: 'haveType',
        message: 'problem a',
      },
      {
        severity: 'error',
        filePath: 'src/b.ts',
        predicateName: 'haveType',
        message: 'problem b',
      },
    ];
    const output = reporter.format(makeResult({ diagnostics }));
    const lines = output.split('\n');
    const aIdx = lines.findIndex((l) => l.includes('problem a'));
    expect(lines[aIdx + 1]).toBe('');
  });

  it('makes file paths bold', () => {
    const diagnostics: Diagnostic[] = [
      {
        severity: 'error',
        filePath: 'src/foo.ts',
        predicateName: 'haveType',
        message: 'test',
      },
    ];
    const output = reporter.format(makeResult({ diagnostics }));
    expect(output).toContain(pc.bold('src/foo.ts'));
  });

  it('colors error severity in red', () => {
    const diagnostics: Diagnostic[] = [
      {
        severity: 'error',
        filePath: 'src/foo.ts',
        predicateName: 'haveType',
        message: 'test',
      },
    ];
    const output = reporter.format(makeResult({ diagnostics }));
    expect(output).toContain(pc.red('error'));
  });

  it('uses singular for 1 violation', () => {
    const diagnostics: Diagnostic[] = [
      {
        severity: 'error',
        filePath: 'a.ts',
        predicateName: 'haveType',
        message: 'err1',
      },
    ];
    const output = reporter.format(
      makeResult({ diagnostics, filesChecked: 1, elapsed: 2 })
    );
    expect(output).toContain('Checked 1 file in 2ms. Found 1 violation.');
  });

  it('uses plural for multiple violations', () => {
    const diagnostics: Diagnostic[] = [
      {
        severity: 'error',
        filePath: 'a.ts',
        predicateName: 'haveType',
        message: 'err1',
      },
      {
        severity: 'error',
        filePath: 'b.ts',
        predicateName: 'haveType',
        message: 'err2',
      },
    ];
    const output = reporter.format(
      makeResult({ diagnostics, filesChecked: 2, elapsed: 3 })
    );
    expect(output).toContain('Checked 2 files in 3ms. Found 2 violations.');
  });
});

describe('createDefaultReporter with colors disabled', () => {
  const reporter = createDefaultReporter({ colors: false });

  it('does not include ANSI escape codes in output', () => {
    const diagnostics: Diagnostic[] = [
      {
        severity: 'error',
        filePath: 'src/foo.ts',
        predicateName: 'haveType',
        message: 'Missing export',
        conventionName: 'provider-packages',
        line: 5,
      },
    ];
    const output = reporter.format(makeResult({ diagnostics }));
    expect(output.includes('\x1b[')).toBe(false);
  });

  it('still contains all diagnostic content', () => {
    const diagnostics: Diagnostic[] = [
      {
        severity: 'error',
        filePath: 'src/bar.ts',
        predicateName: 'haveType',
        message: 'Something wrong',
        conventionName: 'my-convention',
      },
    ];
    const output = reporter.format(makeResult({ diagnostics }));
    expect(output).toContain('src/bar.ts');
    expect(output).toContain('error');
    expect(output).toContain('Something wrong');
    expect(output).toContain('[my-convention]');
    expect(output).toContain('Found 1 violation.');
  });

  it('returns plain severity without red', () => {
    const diagnostics: Diagnostic[] = [
      {
        severity: 'error',
        filePath: 'src/foo.ts',
        predicateName: 'haveType',
        message: 'test',
      },
    ];
    const output = reporter.format(makeResult({ diagnostics }));
    const lines = output.split('\n');
    const diagLine = lines.find((l) => l.includes('test'));
    expect(diagLine).toBeDefined();
    expect(diagLine).toContain('error');
    expect(diagLine).toBe('  -  error  test');
  });
});

describe('createJsonReporter', () => {
  const reporter = createJsonReporter();

  it('returns valid JSON parseable by JSON.parse', () => {
    const diagnostics: Diagnostic[] = [
      {
        severity: 'error',
        filePath: 'src/foo.ts',
        predicateName: 'haveType',
        message: 'Some problem',
        conventionName: 'my-convention',
      },
    ];
    const output = reporter.format(makeResult({ diagnostics }));
    expect(() => JSON.parse(output)).not.toThrow();
  });

  it('returns empty array for no diagnostics', () => {
    const output = reporter.format(makeResult({ diagnostics: [] }));
    expect(JSON.parse(output)).toEqual([]);
  });

  it('outputs correct fields for line-level diagnostic', () => {
    const diagnostics: Diagnostic[] = [
      {
        severity: 'error',
        filePath: 'src/foo.ts',
        predicateName: 'exportInterfaces',
        message: 'Missing interface',
        conventionName: 'provider-interface',
        line: 3,
        column: 5,
      },
    ];
    const parsed = JSON.parse(reporter.format(makeResult({ diagnostics })));
    expect(parsed).toEqual([
      {
        severity: 'error',
        conventionName: 'provider-interface',
        filePath: 'src/foo.ts',
        predicateName: 'exportInterfaces',
        message: 'Missing interface',
        line: 3,
      },
    ]);
  });

  it('omits line for file-level diagnostic', () => {
    const diagnostics: Diagnostic[] = [
      {
        severity: 'error',
        filePath: 'src/foo.ts',
        predicateName: 'haveFiles',
        message: 'Missing required file',
        conventionName: 'my-convention',
      },
    ];
    const parsed = JSON.parse(reporter.format(makeResult({ diagnostics })));
    expect(parsed[0]).not.toHaveProperty('line');
  });

  it('omits column from JSON output', () => {
    const diagnostics: Diagnostic[] = [
      {
        severity: 'error',
        filePath: 'src/foo.ts',
        predicateName: 'exportInterfaces',
        message: 'test',
        line: 10,
        column: 5,
      },
    ];
    const parsed = JSON.parse(reporter.format(makeResult({ diagnostics })));
    expect(parsed[0]).not.toHaveProperty('column');
  });

  it('includes multiple diagnostics as array elements', () => {
    const diagnostics: Diagnostic[] = [
      {
        severity: 'error',
        filePath: 'src/a.ts',
        predicateName: 'haveType',
        message: 'problem a',
      },
      {
        severity: 'error',
        filePath: 'src/b.ts',
        predicateName: 'haveType',
        message: 'problem b',
        line: 5,
      },
    ];
    const parsed = JSON.parse(reporter.format(makeResult({ diagnostics })));
    expect(parsed).toHaveLength(2);
    expect(parsed[0].message).toBe('problem a');
    expect(parsed[1].message).toBe('problem b');
    expect(parsed[1].line).toBe(5);
  });
});

describe('createGithubReporter', () => {
  const reporter = createGithubReporter();

  it('returns empty string for no diagnostics', () => {
    expect(reporter.format(makeResult({ diagnostics: [] }))).toBe('');
  });

  it('formats file-level violation without line parameter', () => {
    const diagnostics: Diagnostic[] = [
      {
        severity: 'error',
        filePath: 'packages/openai/src/index.ts',
        predicateName: 'export',
        message: 'Missing export "openai"',
        conventionName: 'provider-packages',
      },
    ];
    const output = reporter.format(makeResult({ diagnostics }));
    expect(output).toBe(
      '::error file=packages/openai/src/index.ts,title=provider-packages::Missing export "openai"'
    );
  });

  it('includes line parameter for line-specific violations', () => {
    const diagnostics: Diagnostic[] = [
      {
        severity: 'error',
        filePath: 'packages/openai/src/openai-provider.ts',
        predicateName: 'exportInterfaces',
        message: 'Interface "OpenaiProvider" must extend "ProviderV1"',
        conventionName: 'provider-interface',
        line: 3,
      },
    ];
    const output = reporter.format(makeResult({ diagnostics }));
    expect(output).toBe(
      '::error file=packages/openai/src/openai-provider.ts,line=3,title=provider-interface::Interface "OpenaiProvider" must extend "ProviderV1"'
    );
  });

  it('omits column even when present on diagnostic', () => {
    const diagnostics: Diagnostic[] = [
      {
        severity: 'error',
        filePath: 'src/foo.ts',
        predicateName: 'haveType',
        message: 'test',
        line: 10,
        column: 5,
      },
    ];
    const output = reporter.format(makeResult({ diagnostics }));
    expect(output).not.toContain('col=');
    expect(output).not.toContain('column=');
    expect(output).toBe('::error file=src/foo.ts,line=10::test');
  });

  it('omits title when conventionName is absent', () => {
    const diagnostics: Diagnostic[] = [
      {
        severity: 'error',
        filePath: 'src/foo.ts',
        predicateName: 'haveType',
        message: 'Some problem',
      },
    ];
    const output = reporter.format(makeResult({ diagnostics }));
    expect(output).toBe('::error file=src/foo.ts::Some problem');
  });

  it('joins multiple diagnostics with newlines', () => {
    const diagnostics: Diagnostic[] = [
      {
        severity: 'error',
        filePath: 'src/a.ts',
        predicateName: 'haveType',
        message: 'problem a',
        conventionName: 'conv-a',
      },
      {
        severity: 'error',
        filePath: 'src/b.ts',
        predicateName: 'haveType',
        message: 'problem b',
        conventionName: 'conv-b',
        line: 5,
      },
    ];
    const output = reporter.format(makeResult({ diagnostics }));
    const lines = output.split('\n');
    expect(lines).toHaveLength(2);
    expect(lines[0]).toBe('::error file=src/a.ts,title=conv-a::problem a');
    expect(lines[1]).toBe(
      '::error file=src/b.ts,line=5,title=conv-b::problem b'
    );
  });
});

describe('createMarkdownReporter', () => {
  const reporter = createMarkdownReporter();

  it('returns summary for no diagnostics', () => {
    const output = reporter.format(
      makeResult({ diagnostics: [], filesChecked: 5, elapsed: 3 })
    );
    expect(output).toContain('Checked 5 files in 3ms.');
    expect(output).toContain('No violations found.');
  });

  it('formats diagnostics as Markdown tables grouped by file', () => {
    const diagnostics: Diagnostic[] = [
      {
        severity: 'error',
        filePath: 'packages/openai/src/index.ts',
        predicateName: 'export',
        message: 'Missing export "openai"',
        conventionName: 'provider-packages',
      },
      {
        severity: 'error',
        filePath: 'packages/openai/src/index.ts',
        predicateName: 'export',
        message: 'Missing export type "OpenaiProvider"',
        conventionName: 'provider-packages',
      },
      {
        severity: 'error',
        filePath: 'packages/openai/src/openai-provider.ts',
        predicateName: 'importType',
        message: 'Missing import type "ProviderV1"',
        conventionName: 'provider-interface',
      },
      {
        severity: 'error',
        filePath: 'packages/openai/src/openai-provider.ts',
        predicateName: 'exportInterfaces',
        message: 'Interface "OpenaiProvider" must extend "ProviderV1"',
        conventionName: 'provider-interface',
        line: 3,
      },
    ];
    const output = reporter.format(
      makeResult({ diagnostics, filesChecked: 2, elapsed: 8 })
    );
    expect(output).toContain('**`packages/openai/src/index.ts`**');
    expect(output).toContain('**`packages/openai/src/openai-provider.ts`**');
    expect(output).toContain('| Line | Severity | Message | Convention |');
    expect(output).toContain('|------|----------|---------|------------|');
    expect(output).toContain(
      '| - | error | Missing export "openai" | provider-packages |'
    );
    expect(output).toContain(
      '| 3 | error | Interface "OpenaiProvider" must extend "ProviderV1" | provider-interface |'
    );
    expect(output).toContain('**Checked 2 files in 8ms. Found 4 violations.**');
  });

  it('uses dash in Line column for file-level violations', () => {
    const diagnostics: Diagnostic[] = [
      {
        severity: 'error',
        filePath: 'src/foo.ts',
        predicateName: 'haveType',
        message: 'file-level issue',
      },
    ];
    const output = reporter.format(makeResult({ diagnostics }));
    expect(output).toContain('| - | error | file-level issue |');
  });

  it('uses line number in Line column when provided', () => {
    const diagnostics: Diagnostic[] = [
      {
        severity: 'error',
        filePath: 'src/foo.ts',
        predicateName: 'haveType',
        message: 'line issue',
        line: 42,
      },
    ];
    const output = reporter.format(makeResult({ diagnostics }));
    expect(output).toContain('| 42 | error | line issue |');
  });

  it('lists file-level violations before line-specific ones', () => {
    const diagnostics: Diagnostic[] = [
      {
        severity: 'error',
        filePath: 'src/foo.ts',
        predicateName: 'haveType',
        message: 'line 10 issue',
        line: 10,
      },
      {
        severity: 'error',
        filePath: 'src/foo.ts',
        predicateName: 'haveType',
        message: 'file-level issue',
      },
      {
        severity: 'error',
        filePath: 'src/foo.ts',
        predicateName: 'haveType',
        message: 'line 5 issue',
        line: 5,
      },
    ];
    const output = reporter.format(makeResult({ diagnostics }));
    const rows = output
      .split('\n')
      .filter(
        (l) =>
          l.startsWith('|') && !l.startsWith('| Line') && !l.startsWith('|--')
      );
    expect(rows[0]).toContain('file-level issue');
    expect(rows[1]).toContain('line 5 issue');
    expect(rows[2]).toContain('line 10 issue');
  });

  it('shows empty convention column when conventionName is absent', () => {
    const diagnostics: Diagnostic[] = [
      {
        severity: 'error',
        filePath: 'src/foo.ts',
        predicateName: 'haveType',
        message: 'Some problem',
      },
    ];
    const output = reporter.format(makeResult({ diagnostics }));
    expect(output).toContain('| - | error | Some problem |  |');
  });

  it('separates file groups with blank lines', () => {
    const diagnostics: Diagnostic[] = [
      {
        severity: 'error',
        filePath: 'src/a.ts',
        predicateName: 'haveType',
        message: 'problem a',
      },
      {
        severity: 'error',
        filePath: 'src/b.ts',
        predicateName: 'haveType',
        message: 'problem b',
      },
    ];
    const output = reporter.format(makeResult({ diagnostics }));
    expect(output).toContain('|  |\n\n**`src/b.ts`**');
  });

  it('wraps file paths in bold backticks', () => {
    const diagnostics: Diagnostic[] = [
      {
        severity: 'error',
        filePath: 'src/foo.ts',
        predicateName: 'haveType',
        message: 'test',
      },
    ];
    const output = reporter.format(makeResult({ diagnostics }));
    expect(output).toContain('**`src/foo.ts`**');
  });
});
