import type { PredicateContext } from "../../core/context.js";
import type { Diagnostic, DiagnosticSeverity } from "../../core/diagnostics.js";
import type { FileStructure } from "../types.js";
import {
  createExportedDeclarationDiagnostic,
  createMissingDeclarationDiagnostic,
  type DeclarationCheckContext,
  findDeclarationSymbol,
  isDeclarationSymbolExported,
  resolveDefinitionName,
} from "./declaration-utils.js";

export function checkDeclareConstants(opts: {
  expected: (string | { name: string })[];
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
    }
  }

  return diagnostics;
}
