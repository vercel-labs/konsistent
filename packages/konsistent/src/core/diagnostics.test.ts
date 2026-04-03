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

  it('defaults severity to error when not specified', () => {
    const d = createDiagnostic({
      filePath: 'src/foo.ts',
      predicateName: 'export',
      message: 'Missing export',
    });
    expect(d.severity).toBe('error');
  });

  it('creates a warning diagnostic when severity is warning', () => {
    const d = createDiagnostic({
      filePath: 'src/foo.ts',
      predicateName: 'export',
      message: 'Missing export',
      severity: 'warning',
    });
    expect(d.severity).toBe('warning');
  });

  it('creates an error diagnostic when severity is explicitly error', () => {
    const d = createDiagnostic({
      filePath: 'src/foo.ts',
      predicateName: 'export',
      message: 'Missing export',
      severity: 'error',
    });
    expect(d.severity).toBe('error');
  });
});
