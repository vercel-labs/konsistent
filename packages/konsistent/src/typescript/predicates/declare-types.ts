import type { TypeDefinitionV1 } from "@konsistent/convention";
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
import { checkTypeDefinitionConstraint } from "../definition-type-constraint.js";
import type { FileStructure } from "../types.js";

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
    const definition: TypeDefinitionV1 =
      typeof entry === "string" ? { name: entry } : entry;
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

    const constraintDiagnostic = checkTypeDefinitionConstraint({
      context,
      conventionName,
      definition,
      fallbackPosition: symbol.pos,
      fileStructure,
      name: resolvedName,
      predicateName: "declareTypes",
      severity,
    });
    if (constraintDiagnostic) {
      diagnostics.push(constraintDiagnostic);
    }
  }

  return diagnostics;
}
