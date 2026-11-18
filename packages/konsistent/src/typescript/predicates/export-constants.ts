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
    const resolvedFrom = Object.hasOwn(definition, "from")
      ? context.resolveTemplate(Reflect.get(definition, "from") as string)
      : undefined;

    const found = fileStructure.exports.some(
      (e) =>
        e.name === resolvedName &&
        !e.isType &&
        (e.kind === "const" || e.kind === "re-export") &&
        (resolvedFrom === undefined || e.from === resolvedFrom)
    );

    if (!found) {
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

    // A re-export has no local declaration to inspect, so schema and type
    // checks only apply when the constant is declared in this file.
    const hasLocalConstant =
      resolvedFrom === undefined &&
      fileStructure.constants.some(
        (constant) => constant.name === resolvedName
      );
    if (!hasLocalConstant) {
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
