import type { PredicateContext } from "../../core/context.js";
import type { Diagnostic, DiagnosticSeverity } from "../../core/diagnostics.js";
import { createDiagnostic } from "../../core/diagnostics.js";
import type { FileStructure } from "../types.js";

export function checkExportValues(opts: {
  expected: (string | { alias?: string; name: string; from?: string })[];
  predicateName?: "export" | "exportValues";
  context: PredicateContext;
  fileStructure: FileStructure;
  conventionName?: string;
  severity?: DiagnosticSeverity;
}): Diagnostic[] {
  const {
    expected,
    predicateName = "exportValues",
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

    const found =
      resolvedAlias === undefined || predicateName === "export"
        ? fileStructure.exports.some(
            (e) =>
              e.name === resolvedName &&
              !e.isType &&
              (resolvedFrom === undefined || e.from === resolvedFrom)
          )
        : fileStructure.namedExportSymbols.some(
            (e) =>
              e.sourceName !== "default" &&
              e.sourceName === resolvedName &&
              e.name === resolvedAlias &&
              !e.isType &&
              (resolvedFrom === undefined || e.from === resolvedFrom)
          );

    if (!found) {
      diagnostics.push(
        createDiagnostic({
          filePath: context.path,
          predicateName,
          message: formatMissingExportMessage({
            name: resolvedName,
            alias: resolvedAlias,
            from: resolvedFrom,
          }),
          conventionName,
          severity,
        })
      );
    }
  }

  return diagnostics;
}

function formatMissingExportMessage(opts: {
  name: string;
  alias?: string;
  from?: string;
}): string {
  const alias = opts.alias === undefined ? "" : ` as "${opts.alias}"`;
  const from = opts.from === undefined ? "" : ` from "${opts.from}"`;
  return `Missing export "${opts.name}"${alias}${from}`;
}
