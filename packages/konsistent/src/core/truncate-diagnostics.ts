import type { Diagnostic } from './diagnostics.js';

export interface TruncateResult {
  diagnostics: Diagnostic[];
  omitted: number;
}

export function truncateDiagnostics(opts: {
  diagnostics: Diagnostic[];
  max: number;
}): TruncateResult {
  if (opts.diagnostics.length <= opts.max) {
    return { diagnostics: opts.diagnostics, omitted: 0 };
  }
  return {
    diagnostics: opts.diagnostics.slice(0, opts.max),
    omitted: opts.diagnostics.length - opts.max,
  };
}

export function formatTruncationMessage(omitted: number): string {
  return `... and ${omitted} more diagnostics (use --max-diagnostics to see more)`;
}
