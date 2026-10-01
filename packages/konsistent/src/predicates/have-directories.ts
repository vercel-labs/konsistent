import type { PredicateContext } from "../core/context.js";
import type { Diagnostic, DiagnosticSeverity } from "../core/diagnostics.js";
import { createDiagnostic } from "../core/diagnostics.js";

export function checkHaveDirectories(opts: {
  expected: string[];
  context: PredicateContext;
  conventionName?: string;
  severity?: DiagnosticSeverity;
}): Diagnostic[] {
  const { expected, context, conventionName, severity } = opts;
  const diagnostics: Diagnostic[] = [];

  for (const directoryTemplate of expected) {
    const resolved = context.resolveTemplate(directoryTemplate);
    if (!context.directoryExists(resolved)) {
      diagnostics.push(
        createDiagnostic({
          filePath: context.path,
          predicateName: "haveDirectories",
          message: `Missing required directory: ${resolved}`,
          conventionName,
          severity,
        })
      );
    }
  }

  return diagnostics;
}
