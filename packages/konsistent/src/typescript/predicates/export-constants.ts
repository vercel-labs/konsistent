import type { ExportConstantDefinitionV1 } from "@konsistent/convention";
import type { PredicateContext } from "../../core/context.js";
import type { Diagnostic, DiagnosticSeverity } from "../../core/diagnostics.js";
import { createDiagnostic } from "../../core/diagnostics.js";
import { checkConstantDefinitionConstraint } from "../definition-type-constraint.js";
import type { FileStructure } from "../types.js";

export function checkExportConstants(opts: {
  expected: (string | ExportConstantDefinitionV1)[];
  context: PredicateContext;
  fileStructure: FileStructure;
  conventionName?: string;
  severity?: DiagnosticSeverity;
}): Diagnostic[] {
  const { expected, context, fileStructure, conventionName, severity } = opts;
  const diagnostics: Diagnostic[] = [];

  for (const entry of expected) {
    const definition: ExportConstantDefinitionV1 =
      typeof entry === "string" ? { name: entry } : entry;
    const resolvedName = context.resolveTemplate(definition.name);

    const localName = findExportedConstant({
      fileStructure,
      name: resolvedName,
    });

    if (localName === undefined) {
      diagnostics.push(
        createDiagnostic({
          conventionName,
          filePath: context.path,
          message: `Missing export constant "${resolvedName}"`,
          predicateName: "exportConstants",
          severity,
        })
      );
      continue;
    }

    const constraintDiagnostic = checkConstantDefinitionConstraint({
      context,
      conventionName,
      definition,
      fileStructure,
      name: localName,
      predicateName: "exportConstants",
      severity,
    });
    if (constraintDiagnostic) {
      diagnostics.push(constraintDiagnostic);
    }
  }

  return diagnostics;
}

// Returns the local name of the constant exported as `name`, either declared
// with `export const` or declared here and exported with `export { local as name }`.
function findExportedConstant(opts: {
  fileStructure: FileStructure;
  name: string;
}): string | undefined {
  const { fileStructure, name } = opts;
  if (
    fileStructure.exports.some(
      (e) => e.name === name && e.kind === "const" && !e.isType
    )
  ) {
    return name;
  }
  return fileStructure.namedExportSymbols.find(
    (symbol) =>
      symbol.name === name &&
      symbol.from === undefined &&
      !symbol.isType &&
      fileStructure.constants.some(
        (constant) => constant.name === symbol.sourceName
      )
  )?.sourceName;
}
