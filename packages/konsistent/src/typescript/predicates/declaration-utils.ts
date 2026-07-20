import type { PredicateContext } from "../../core/context.js";
import type { Diagnostic, DiagnosticSeverity } from "../../core/diagnostics.js";
import { createDiagnostic } from "../../core/diagnostics.js";
import type {
  DeclarationSymbolInfo,
  DeclarationSymbolKind,
  FileStructure,
} from "../types.js";

export interface DeclarationCheckContext {
  context: PredicateContext;
  conventionName?: string;
  predicateName: string;
  severity?: DiagnosticSeverity;
}

export function resolveDefinitionName(opts: {
  entry: string | { name: string };
  context: PredicateContext;
}): string {
  const { entry, context } = opts;
  const definition = typeof entry === "string" ? { name: entry } : entry;
  return context.resolveTemplate(definition.name);
}

export function findDeclarationSymbol(opts: {
  fileStructure: FileStructure;
  kinds: DeclarationSymbolKind[];
  name: string;
}): DeclarationSymbolInfo | undefined {
  const { fileStructure, kinds, name } = opts;
  return fileStructure.declarationSymbols.find(
    (symbol) => symbol.name === name && kinds.includes(symbol.kind)
  );
}

export function findTypeDefinition(opts: {
  fileStructure: FileStructure;
  name: string;
}) {
  const { fileStructure, name } = opts;
  return (
    fileStructure.typeAliases.find((typeAlias) => typeAlias.name === name) ??
    fileStructure.interfaces.find(
      (interfaceInfo) => interfaceInfo.name === name
    )
  );
}

export function isDeclarationSymbolExported(opts: {
  fileStructure: FileStructure;
  symbol: DeclarationSymbolInfo;
}): boolean {
  const { fileStructure, symbol } = opts;
  return (
    symbol.isExported ||
    symbol.isDefaultExport ||
    fileStructure.namedExportSymbols.some(
      (exportSymbol) => exportSymbol.sourceName === symbol.name
    ) ||
    fileStructure.defaultExportSymbols.some(
      (exportSymbol) => exportSymbol.name === symbol.name
    )
  );
}

export function createMissingDeclarationDiagnostic(opts: {
  checkContext: DeclarationCheckContext;
  label: string;
  name: string;
}): Diagnostic {
  const { checkContext, label, name } = opts;
  return createDiagnostic({
    filePath: checkContext.context.path,
    predicateName: checkContext.predicateName,
    message: `Missing local ${label} declaration "${name}"`,
    conventionName: checkContext.conventionName,
    severity: checkContext.severity,
  });
}

export function createExportedDeclarationDiagnostic(opts: {
  checkContext: DeclarationCheckContext;
  label: string;
  symbol: DeclarationSymbolInfo;
}): Diagnostic {
  const { checkContext, label, symbol } = opts;
  return createDiagnostic({
    filePath: checkContext.context.path,
    predicateName: checkContext.predicateName,
    message: `Local ${label} declaration "${symbol.name}" must not be exported`,
    conventionName: checkContext.conventionName,
    line: symbol.pos.line,
    column: symbol.pos.column,
    severity: checkContext.severity,
  });
}
