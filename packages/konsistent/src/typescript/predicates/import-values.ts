import type { PredicateContext } from "../../core/context.js";
import type { Diagnostic, DiagnosticSeverity } from "../../core/diagnostics.js";
import { createDiagnostic } from "../../core/diagnostics.js";
import { hasImport } from "../import-matcher.js";
import type { FileStructure } from "../types.js";

export function checkImportValues(opts: {
  expected: (string | { alias?: string; name: string; from?: string })[];
  predicateName?: "import" | "importValues";
  context: PredicateContext;
  fileStructure: FileStructure;
  conventionName?: string;
  severity?: DiagnosticSeverity;
}): Diagnostic[] {
  const {
    expected,
    predicateName = "importValues",
    context,
    fileStructure,
    conventionName,
    severity,
  } = opts;
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
      expected: entry,
      importKind: "value",
      matchLocalName: predicateName === "import",
      context,
      fileStructure,
    });

    if (!found) {
      diagnostics.push(
        createDiagnostic({
          filePath: context.path,
          predicateName,
          message:
            resolvedAlias === undefined
              ? `Missing import "${resolvedName}"`
              : `Missing import "${resolvedName}" as "${resolvedAlias}"`,
          conventionName,
          severity,
        })
      );
    }
  }

  return diagnostics;
}
