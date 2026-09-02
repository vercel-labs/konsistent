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

    const found = fileStructure.exports.some(
      (e) => e.name === resolvedName && e.kind === "const" && !e.isType
    );

    if (!found) {
      diagnostics.push(
        createDiagnostic({
          filePath: context.path,
          predicateName: "exportConstants",
          message: `Missing export constant "${resolvedName}"`,
          conventionName,
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
      name: resolvedName,
      predicateName: "exportConstants",
      severity,
    });
    if (constraintDiagnostic) {
      diagnostics.push(constraintDiagnostic);
    }
  }

  return diagnostics;
}
