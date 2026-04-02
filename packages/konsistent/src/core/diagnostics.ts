export interface Diagnostic {
  severity: 'error';
  filePath: string;
  predicateName: string;
  message: string;
  conventionName?: string;
  line?: number;
  column?: number;
}

export function createDiagnostic(opts: {
  filePath: string;
  predicateName: string;
  message: string;
  conventionName?: string;
  line?: number;
  column?: number;
}): Diagnostic {
  return {
    severity: 'error',
    filePath: opts.filePath,
    predicateName: opts.predicateName,
    message: opts.message,
    conventionName: opts.conventionName,
    line: opts.line,
    column: opts.column,
  };
}
