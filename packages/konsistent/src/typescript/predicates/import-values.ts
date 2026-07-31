import type { PredicateContext } from "../../core/context.js";
import type { Diagnostic, DiagnosticSeverity } from "../../core/diagnostics.js";
import { createDiagnostic } from "../../core/diagnostics.js";
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
    const resolvedFrom = definition.from
      ? context.resolveTemplate(definition.from)
      : undefined;
    const resolvedAlias =
      definition.alias === undefined
        ? undefined
        : context.resolveTemplate(definition.alias);

    const found = fileStructure.imports.some(
      (i) =>
        !i.isType &&
        (resolvedFrom === undefined || i.from === resolvedFrom) &&
        (predicateName === "import"
          ? i.name === resolvedName
          : matchesImportName({
              importInfo: i,
              name: resolvedName,
              alias: resolvedAlias,
            }))
    );

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

function matchesImportName(opts: {
  importInfo: FileStructure["imports"][number];
  name: string;
  alias?: string;
}): boolean {
  const { importInfo, name, alias } = opts;
  if (alias !== undefined) {
    return (
      importInfo.kind === "named" &&
      importInfo.sourceName !== "default" &&
      importInfo.sourceName === name &&
      importInfo.name === alias
    );
  }
  if (importInfo.kind === "named" && importInfo.sourceName !== "default") {
    return importInfo.sourceName === name;
  }
  return importInfo.name === name;
}
