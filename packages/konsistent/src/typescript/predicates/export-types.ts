import type { ExportTypeDefinitionV1 } from "@konsistent/convention";
import type { PredicateContext } from "../../core/context.js";
import type { Diagnostic, DiagnosticSeverity } from "../../core/diagnostics.js";
import { createDiagnostic } from "../../core/diagnostics.js";
import { checkTypeDefinitionConstraint } from "../definition-type-constraint.js";
import type { FileStructure } from "../types.js";

export function checkExportTypes(opts: {
  expected: (string | ExportTypeDefinitionV1)[];
  context: PredicateContext;
  fileStructure: FileStructure;
  conventionName?: string;
  severity?: DiagnosticSeverity;
}): Diagnostic[] {
  const { expected, context, fileStructure, conventionName, severity } = opts;
  const diagnostics: Diagnostic[] = [];

  for (const entry of expected) {
    const definition: ExportTypeDefinitionV1 =
      typeof entry === "string" ? { name: entry } : entry;
    const resolvedName = context.resolveTemplate(definition.name);
    const resolvedFrom = Object.hasOwn(definition, "from")
      ? context.resolveTemplate((definition as { from: string }).from)
      : undefined;
    const resolvedAlias =
      Object.hasOwn(definition, "alias") &&
      (definition as { alias?: string }).alias !== undefined
        ? context.resolveTemplate((definition as { alias: string }).alias)
        : undefined;

    const found = findExportedType({
      fileStructure,
      name: resolvedName,
      alias: resolvedAlias,
      from: resolvedFrom,
    });

    if (!found) {
      diagnostics.push(
        createDiagnostic({
          filePath: context.path,
          predicateName: "exportTypes",
          message: formatMissingExportMessage({
            name: resolvedName,
            alias: resolvedAlias,
            from: resolvedFrom,
          }),
          conventionName,
          severity,
        })
      );
      continue;
    }

    const constraintDiagnostic = checkTypeDefinitionConstraint({
      context,
      conventionName,
      definition,
      fallbackPosition: found.pos,
      fileStructure,
      name: resolvedName,
      predicateName: "exportTypes",
      severity,
    });
    if (constraintDiagnostic) {
      diagnostics.push(constraintDiagnostic);
    }
  }

  return diagnostics;
}

function findExportedType(opts: {
  fileStructure: FileStructure;
  name: string;
  alias?: string;
  from?: string;
}):
  | FileStructure["exports"][number]
  | FileStructure["namedExportSymbols"][number]
  | undefined {
  const { fileStructure, name, alias, from } = opts;
  if (alias === undefined) {
    return fileStructure.exports.find(
      (entry) =>
        entry.name === name &&
        entry.isType &&
        (from === undefined || entry.from === from)
    );
  }
  return fileStructure.namedExportSymbols.find(
    (entry) =>
      entry.sourceName !== "default" &&
      entry.sourceName === name &&
      entry.name === alias &&
      entry.isType &&
      (from === undefined || entry.from === from)
  );
}

function formatMissingExportMessage(opts: {
  name: string;
  alias?: string;
  from?: string;
}): string {
  const alias = opts.alias === undefined ? "" : ` as "${opts.alias}"`;
  const from = opts.from === undefined ? "" : ` from "${opts.from}"`;
  return `Missing export type "${opts.name}"${alias}${from}`;
}
