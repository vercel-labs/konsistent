import { describe, expect, it } from 'vitest';
import type { Diagnostic } from './diagnostics.js';
import { createDefaultReporter } from './reporter.js';

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
    expect(output).toContain('src/foo.ts');
    expect(output).toContain('src/bar.ts');
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
    expect(output).toContain('  -  error  test message');
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
    expect(output).toContain('  42  error  test message');
  });
});
