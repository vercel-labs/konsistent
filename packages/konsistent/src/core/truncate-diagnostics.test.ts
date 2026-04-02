import { describe, expect, it } from 'vitest';
import type { Diagnostic } from './diagnostics.js';
import {
  formatTruncationMessage,
  truncateDiagnostics,
} from './truncate-diagnostics.js';

function makeDiag(msg: string): Diagnostic {
  return {
    severity: 'error',
    filePath: 'src/foo.ts',
    predicateName: 'haveType',
    message: msg,
  };
}

describe('truncateDiagnostics', () => {
  it('returns all diagnostics when count is within max', () => {
    const diagnostics = [makeDiag('a'), makeDiag('b')];
    const result = truncateDiagnostics({ diagnostics, max: 5 });
    expect(result.diagnostics).toHaveLength(2);
    expect(result.omitted).toBe(0);
  });

  it('returns all diagnostics when count equals max', () => {
    const diagnostics = [makeDiag('a'), makeDiag('b')];
    const result = truncateDiagnostics({ diagnostics, max: 2 });
    expect(result.diagnostics).toHaveLength(2);
    expect(result.omitted).toBe(0);
  });

  it('truncates when count exceeds max', () => {
    const diagnostics = [makeDiag('a'), makeDiag('b'), makeDiag('c')];
    const result = truncateDiagnostics({ diagnostics, max: 1 });
    expect(result.diagnostics).toHaveLength(1);
    expect(result.diagnostics[0].message).toBe('a');
    expect(result.omitted).toBe(2);
  });

  it('truncates to zero when max is 0', () => {
    const diagnostics = [makeDiag('a')];
    const result = truncateDiagnostics({ diagnostics, max: 0 });
    expect(result.diagnostics).toHaveLength(0);
    expect(result.omitted).toBe(1);
  });
});

describe('formatTruncationMessage', () => {
  it('includes the omitted count', () => {
    expect(formatTruncationMessage(5)).toBe(
      '... and 5 more diagnostics (use --max-diagnostics to see more)'
    );
  });

  it('works with 1 omitted', () => {
    expect(formatTruncationMessage(1)).toBe(
      '... and 1 more diagnostics (use --max-diagnostics to see more)'
    );
  });
});
