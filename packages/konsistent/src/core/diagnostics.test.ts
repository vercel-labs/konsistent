import { describe, expect, it } from 'vitest';
import { createDiagnostic } from './diagnostics.js';

describe('createDiagnostic', () => {
  it('creates a diagnostic with required fields', () => {
    const d = createDiagnostic({
      filePath: 'src/foo.ts',
      predicateName: 'haveType',
      message: 'Expected a file',
    });
    expect(d).toEqual({
      severity: 'error',
      filePath: 'src/foo.ts',
      predicateName: 'haveType',
      message: 'Expected a file',
      conventionName: undefined,
      line: undefined,
      column: undefined,
    });
  });

  it('creates a diagnostic with optional fields', () => {
    const d = createDiagnostic({
      filePath: 'src/bar.ts',
      predicateName: 'haveType',
      message: 'Expected a directory',
      conventionName: 'my-convention',
      line: 10,
      column: 5,
    });
    expect(d.severity).toBe('error');
    expect(d.conventionName).toBe('my-convention');
    expect(d.line).toBe(10);
    expect(d.column).toBe(5);
  });
});
