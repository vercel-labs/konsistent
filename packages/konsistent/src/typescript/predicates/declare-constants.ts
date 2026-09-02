import type { ConstantDefinitionV1 } from "@konsistent/convention";
import type { PredicateContext } from "../../core/context.js";
import {
  createExportedDeclarationDiagnostic,
  createMissingDeclarationDiagnostic,
  type DeclarationCheckContext,
  findDeclarationSymbol,
  isDeclarationSymbolExported,
  resolveDefinitionName,
} from "../../core/declaration-utils.js";
import type { Diagnostic, DiagnosticSeverity } from "../../core/diagnostics.js";
import { createDiagnostic } from "../../core/diagnostics.js";
import {
  matchConstantTypeSchema,
  resolveConstantValueSchema,
} from "../constant-type-schema.js";
import type { FileStructure } from "../types.js";

export function checkDeclareConstants(opts: {
  expected: (string | ConstantDefinitionV1)[];
  context: PredicateContext;
  fileStructure: FileStructure;
  conventionName?: string;
  severity?: DiagnosticSeverity;
}): Diagnostic[] {
  const { expected, context, fileStructure, conventionName, severity } = opts;
  const diagnostics: Diagnostic[] = [];
  const checkContext: DeclarationCheckContext = {
    context,
    conventionName,
    predicateName: "declareConstants",
    severity,
  };

  for (const entry of expected) {
    const definition = typeof entry === "string" ? { name: entry } : entry;
    const resolvedName = resolveDefinitionName({ entry, context });
    const symbol = findDeclarationSymbol({
      fileStructure,
      name: resolvedName,
      kinds: ["const"],
    });

    if (!symbol) {
      diagnostics.push(
        createMissingDeclarationDiagnostic({
          checkContext,
          label: "constant",
          name: resolvedName,
        })
      );
      continue;
    }

    if (isDeclarationSymbolExported({ fileStructure, symbol })) {
      diagnostics.push(
        createExportedDeclarationDiagnostic({
          checkContext,
          label: "constant",
          symbol,
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
        schema: resolveConstantValueSchema({
          schema: definition.schema,
          resolveTemplate: context.resolveTemplate,
        }),
      });
      if (!result.matches) {
        diagnostics.push(
          createDiagnostic({
            filePath: context.path,
            predicateName: "declareConstants",
            message: `Constant "${resolvedName}" ${result.reason}`,
            conventionName,
            line: constantInfo?.pos.line ?? symbol.pos.line,
            column: constantInfo?.pos.column ?? symbol.pos.column,
            severity,
          })
        );
      }
    }
  }

  return diagnostics;
}
