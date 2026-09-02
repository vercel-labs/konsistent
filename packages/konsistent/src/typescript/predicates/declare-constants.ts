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
import { checkConstantDefinitionConstraint } from "../definition-type-constraint.js";
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
    const definition: ConstantDefinitionV1 =
      typeof entry === "string" ? { name: entry } : entry;
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

    const constraintDiagnostic = checkConstantDefinitionConstraint({
      context,
      conventionName,
      definition,
      fallbackPosition: symbol.pos,
      fileStructure,
      name: resolvedName,
      predicateName: "declareConstants",
      severity,
    });
    if (constraintDiagnostic) {
      diagnostics.push(constraintDiagnostic);
    }
  }

  return diagnostics;
}
