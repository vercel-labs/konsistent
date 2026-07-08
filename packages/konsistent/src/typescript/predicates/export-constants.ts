import type { ExportConstantDefinitionV1 } from "@konsistent/convention";
import type { PredicateContext } from "../../core/context.js";
import type { Diagnostic, DiagnosticSeverity } from "../../core/diagnostics.js";
import { createDiagnostic } from "../../core/diagnostics.js";
import { matchConstantTypeSchema } from "../constant-type-schema.js";
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
    const definition = typeof entry === "string" ? { name: entry } : entry;
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

    if (definition.schema) {
      const constantInfo = fileStructure.constants.find(
        (constant) => constant.name === resolvedName
      );
      const result = matchConstantTypeSchema({
        actual: constantInfo?.typeInfo,
        schema: definition.schema,
      });
      if (!result.matches) {
        diagnostics.push(
          createDiagnostic({
            filePath: context.path,
            predicateName: "exportConstants",
            message: `Constant "${resolvedName}" ${result.reason}`,
            conventionName,
            line: constantInfo?.pos.line,
            column: constantInfo?.pos.column,
            severity,
          })
        );
      }
    }
  }

  return diagnostics;
}
