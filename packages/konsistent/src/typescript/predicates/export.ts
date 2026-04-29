import type { PredicateContext } from "../../core/context.js";
import type { Diagnostic, DiagnosticSeverity } from "../../core/diagnostics.js";
import { createDiagnostic } from "../../core/diagnostics.js";
import type { FileStructure } from "../types.js";

export function checkExport(opts: {
  expected: (string | { name: string; from?: string })[];
  context: PredicateContext;
  fileStructure: FileStructure;
  conventionName?: string;
  severity?: DiagnosticSeverity;
}): Diagnostic[] {
  const { expected, context, fileStructure, conventionName, severity } = opts;
  const diagnostics: Diagnostic[] = [];

  for (const entry of expected) {
    const definition = typeof entry === "string" ? { name: entry } : entry;
    const resolvedName = context.resolveTemplate(definition.name);
    const resolvedFrom = definition.from
      ? context.resolveTemplate(definition.from)
      : undefined;

    const found = fileStructure.exports.some(
      (e) =>
        e.name === resolvedName &&
        !e.isType &&
        (resolvedFrom === undefined || e.from === resolvedFrom)
    );

    if (!found) {
      diagnostics.push(
        createDiagnostic({
          filePath: context.path,
          predicateName: "export",
          message: resolvedFrom
            ? `Missing export "${resolvedName}" from "${resolvedFrom}"`
            : `Missing export "${resolvedName}"`,
          conventionName,
          severity,
        })
      );
    }
  }

  return diagnostics;
}
