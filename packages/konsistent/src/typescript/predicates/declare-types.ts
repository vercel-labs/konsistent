import type { TypeDefinitionV1 } from "@konsistent/convention";
import type { PredicateContext } from "../../core/context.js";
import type { Diagnostic, DiagnosticSeverity } from "../../core/diagnostics.js";
import { createDiagnostic } from "../../core/diagnostics.js";
import { matchTypeDefinitionSchema } from "../constant-type-schema.js";
import type { FileStructure } from "../types.js";
import {
  createExportedDeclarationDiagnostic,
  createMissingDeclarationDiagnostic,
  type DeclarationCheckContext,
  findDeclarationSymbol,
  findTypeDefinition,
  isDeclarationSymbolExported,
  resolveDefinitionName,
} from "./declaration-utils.js";

export function checkDeclareTypes(opts: {
  expected: (string | TypeDefinitionV1)[];
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
    predicateName: "declareTypes",
    severity,
  };

  for (const entry of expected) {
    const definition = typeof entry === "string" ? { name: entry } : entry;
    const resolvedName = resolveDefinitionName({ entry, context });
    const symbol = findDeclarationSymbol({
      fileStructure,
      name: resolvedName,
      kinds: ["interface", "type"],
    });

    if (!symbol) {
      diagnostics.push(
        createMissingDeclarationDiagnostic({
          checkContext,
          label: "type",
          name: resolvedName,
        })
      );
      continue;
    }

    if (isDeclarationSymbolExported({ fileStructure, symbol })) {
      diagnostics.push(
        createExportedDeclarationDiagnostic({
          checkContext,
          label: "type",
          symbol,
        })
      );
      continue;
    }

    if (definition.schema) {
      const typeDefinition = findTypeDefinition({
        fileStructure,
        name: resolvedName,
      });
      const result = matchTypeDefinitionSchema({
        actual: typeDefinition?.typeInfo,
        schema: definition.schema,
      });
      if (!result.matches) {
        diagnostics.push(
          createDiagnostic({
            filePath: context.path,
            predicateName: "declareTypes",
            message: `Type "${resolvedName}" ${result.reason}`,
            conventionName,
            line: typeDefinition?.pos.line ?? symbol.pos.line,
            column: typeDefinition?.pos.column ?? symbol.pos.column,
            severity,
          })
        );
      }
    }
  }

  return diagnostics;
}
