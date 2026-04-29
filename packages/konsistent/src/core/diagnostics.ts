export type DiagnosticSeverity = "error" | "warning";

export interface Diagnostic {
  column?: number;
  conventionName?: string;
  filePath: string;
  line?: number;
  message: string;
  predicateName: string;
  severity: DiagnosticSeverity;
}

export function createDiagnostic(opts: {
  filePath: string;
  predicateName: string;
  message: string;
  conventionName?: string;
  line?: number;
  column?: number;
  severity?: DiagnosticSeverity;
}): Diagnostic {
  return {
    severity: opts.severity ?? "error",
    filePath: opts.filePath,
    predicateName: opts.predicateName,
    message: opts.message,
    conventionName: opts.conventionName,
    line: opts.line,
    column: opts.column,
  };
}
