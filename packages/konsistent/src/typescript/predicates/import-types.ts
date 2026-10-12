import type { PredicateContext } from "../../core/context.js";
import type { Diagnostic, DiagnosticSeverity } from "../../core/diagnostics.js";
import { createDiagnostic } from "../../core/diagnostics.js";
import { hasImport } from "../import-matcher.js";
import type { FileStructure } from "../types.js";

export function checkImportTypes(opts: {
  expected: (string | { alias?: string; name: string; from?: string })[];
  context: PredicateContext;
  fileStructure: FileStructure;
  conventionName?: string;
  severity?: DiagnosticSeverity;
}): Diagnostic[] {
  const { expected, context, fileStructure, conventionName, severity } = opts;
  const diagnostics: Diagnostic[] = [];

  for (const entry of expected) {
    const definition: { alias?: string; name: string; from?: string } =
      typeof entry === "string" ? { name: entry } : entry;
    const resolvedName = context.resolveTemplate(definition.name);
    const resolvedAlias =
      definition.alias === undefined
        ? undefined
        : context.resolveTemplate(definition.alias);

    const found = hasImport({
      context,
      expected: entry,
      fileStructure,
      importKind: "type",
    });

    if (!found) {
      diagnostics.push(
        createDiagnostic({
          conventionName,
          filePath: context.path,
          message:
            resolvedAlias === undefined
              ? `Missing import type "${resolvedName}"`
              : `Missing import type "${resolvedName}" as "${resolvedAlias}"`,
          predicateName: "importTypes",
          severity,
        })
      );
    }
  }

  return diagnostics;
}
