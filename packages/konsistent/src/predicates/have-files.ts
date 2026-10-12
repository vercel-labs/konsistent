import type { PredicateContext } from "../core/context.js";
import type { Diagnostic, DiagnosticSeverity } from "../core/diagnostics.js";
import { createDiagnostic } from "../core/diagnostics.js";

export function checkHaveFiles(opts: {
  expected: string[];
  context: PredicateContext;
  conventionName?: string;
  severity?: DiagnosticSeverity;
}): Diagnostic[] {
  const { expected, context, conventionName, severity } = opts;
  const diagnostics: Diagnostic[] = [];

  for (const fileTemplate of expected) {
    const resolved = context.resolveTemplate(fileTemplate);
    if (!context.fileExists(resolved)) {
      diagnostics.push(
        createDiagnostic({
          conventionName,
          filePath: context.path,
          message: `Missing required file: ${resolved}`,
          predicateName: "haveFiles",
          severity,
        })
      );
    }
  }

  return diagnostics;
}
