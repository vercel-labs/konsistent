import pc from 'picocolors';
import { describe, expect, it } from 'vitest';
import type { Diagnostic } from './diagnostics.js';
import { createDefaultReporter, createJsonReporter } from './reporter.js';

describe('createDefaultReporter', () => {
  const reporter = createDefaultReporter();

  it('returns empty string for no diagnostics', () => {
    expect(reporter.format([])).toBe('');
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

    const output = reporter.format(diagnostics);
    expect(output).toContain(pc.bold('src/foo.ts'));
    expect(output).toContain(pc.bold('src/bar.ts'));
    expect(output).toContain('Expected a file but found a directory');
    expect(output).toContain('Found 3 problems (3 errors)');
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
    const output = reporter.format(diagnostics);
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
    const output = reporter.format(diagnostics);
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
    const output = reporter.format(diagnostics);
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
    const output = reporter.format(diagnostics);
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
    const output = reporter.format(diagnostics);
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
    const output = reporter.format(diagnostics);
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
    const output = reporter.format(diagnostics);
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
    const output = reporter.format(diagnostics);
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
    const output = reporter.format(diagnostics);
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
    const output = reporter.format(diagnostics);
    expect(output).toContain(pc.red('error'));
  });

  it('shows correct summary counts', () => {
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
    const output = reporter.format(diagnostics);
    expect(output).toContain('Found 2 problems (2 errors)');
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
    const output = reporter.format(diagnostics);
    expect(() => JSON.parse(output)).not.toThrow();
  });

  it('returns empty array for no diagnostics', () => {
    const output = reporter.format([]);
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
    const parsed = JSON.parse(reporter.format(diagnostics));
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
    const parsed = JSON.parse(reporter.format(diagnostics));
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
    const parsed = JSON.parse(reporter.format(diagnostics));
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
    const parsed = JSON.parse(reporter.format(diagnostics));
    expect(parsed).toHaveLength(2);
    expect(parsed[0].message).toBe('problem a');
    expect(parsed[1].message).toBe('problem b');
    expect(parsed[1].line).toBe(5);
  });
});
