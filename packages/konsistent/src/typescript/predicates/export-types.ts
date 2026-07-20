import type {
  ExportTypeDefinitionV1,
  TypeDefinitionV1,
} from "@konsistent/convention";
import type { PredicateContext } from "../../core/context.js";
import type { Diagnostic, DiagnosticSeverity } from "../../core/diagnostics.js";
import { createDiagnostic } from "../../core/diagnostics.js";
import { matchTypeDefinitionSchema } from "../constant-type-schema.js";
import type { FileStructure } from "../types.js";
import { findTypeDefinition } from "./declaration-utils.js";

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
    const definition = typeof entry === "string" ? { name: entry } : entry;
    const resolvedName = context.resolveTemplate(definition.name);
    const resolvedFrom = Object.hasOwn(definition, "from")
      ? context.resolveTemplate((definition as { from: string }).from)
      : undefined;

    const found = fileStructure.exports.find(
      (e) =>
        e.name === resolvedName &&
        e.isType &&
        (resolvedFrom === undefined || e.from === resolvedFrom)
    );

    if (!found) {
      diagnostics.push(
        createDiagnostic({
          filePath: context.path,
          predicateName: "exportTypes",
          message: resolvedFrom
            ? `Missing export type "${resolvedName}" from "${resolvedFrom}"`
            : `Missing export type "${resolvedName}"`,
          conventionName,
          severity,
        })
      );
      continue;
    }

    const schema = Object.hasOwn(definition, "schema")
      ? (definition as TypeDefinitionV1).schema
      : undefined;
    if (schema) {
      const typeDefinition = findTypeDefinition({
        fileStructure,
        name: resolvedName,
      });
      const result = matchTypeDefinitionSchema({
        actual: typeDefinition?.typeInfo,
        schema,
      });
      if (!result.matches) {
        diagnostics.push(
          createDiagnostic({
            filePath: context.path,
            predicateName: "exportTypes",
            message: `Type "${resolvedName}" ${result.reason}`,
            conventionName,
            line: typeDefinition?.pos.line ?? found.pos.line,
            column: typeDefinition?.pos.column ?? found.pos.column,
            severity,
          })
        );
      }
    }
  }

  return diagnostics;
}
