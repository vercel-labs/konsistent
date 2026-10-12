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
    column: opts.column,
    conventionName: opts.conventionName,
    filePath: opts.filePath,
    line: opts.line,
    message: opts.message,
    predicateName: opts.predicateName,
    severity: opts.severity ?? "error",
  };
}
