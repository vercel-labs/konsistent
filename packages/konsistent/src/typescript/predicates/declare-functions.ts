import type { PredicateContext } from "../../core/context.js";
import type { Diagnostic, DiagnosticSeverity } from "../../core/diagnostics.js";
import { createDiagnostic } from "../../core/diagnostics.js";
import type { FileStructure, FunctionInfo } from "../types.js";
import {
  createExportedDeclarationDiagnostic,
  createMissingDeclarationDiagnostic,
  type DeclarationCheckContext,
  findDeclarationSymbol,
  isDeclarationSymbolExported,
} from "./declaration-utils.js";

interface FunctionDef {
  name: string;
  receiveParamOfType?: string;
  returnValueOfType?: string;
}

function checkSignature(opts: {
  funcInfo: FunctionInfo;
  resolvedName: string;
  resolvedParamType: string | undefined;
  resolvedReturnType: string | undefined;
  checkContext: DeclarationCheckContext;
}): Diagnostic[] {
  const {
    funcInfo,
    resolvedName,
    resolvedParamType,
    resolvedReturnType,
    checkContext,
  } = opts;
  const diagnostics: Diagnostic[] = [];

  if (resolvedParamType) {
    const hasParam = funcInfo.params.some(
      (p) =>
        p.typeName?.text === resolvedParamType ||
        p.typeName?.baseName === resolvedParamType
    );
    if (!hasParam) {
      diagnostics.push(
        createDiagnostic({
          filePath: checkContext.context.path,
          predicateName: checkContext.predicateName,
          message: `Function "${resolvedName}" must receive a parameter of type "${resolvedParamType}"`,
          conventionName: checkContext.conventionName,
          line: funcInfo.pos.line,
          column: funcInfo.pos.column,
          severity: checkContext.severity,
        })
      );
    }
  }

  if (
    resolvedReturnType &&
    funcInfo.returnType?.text !== resolvedReturnType &&
    funcInfo.returnType?.baseName !== resolvedReturnType
  ) {
    diagnostics.push(
      createDiagnostic({
        filePath: checkContext.context.path,
        predicateName: checkContext.predicateName,
        message: `Function "${resolvedName}" must return value of type "${resolvedReturnType}"`,
        conventionName: checkContext.conventionName,
        line: funcInfo.pos.line,
        column: funcInfo.pos.column,
        severity: checkContext.severity,
      })
    );
  }

  return diagnostics;
}

export function checkDeclareFunctions(opts: {
  expected: (string | FunctionDef)[];
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
    predicateName: "declareFunctions",
    severity,
  };

  for (const entry of expected) {
    const definition: FunctionDef =
      typeof entry === "string" ? { name: entry } : entry;
    const resolvedName = context.resolveTemplate(definition.name);
    const resolvedParamType = definition.receiveParamOfType
      ? context.resolveTemplate(definition.receiveParamOfType)
      : undefined;
    const resolvedReturnType = definition.returnValueOfType
      ? context.resolveTemplate(definition.returnValueOfType)
      : undefined;

    const symbol = findDeclarationSymbol({
      fileStructure,
      name: resolvedName,
      kinds: ["function"],
    });
    const funcInfo = fileStructure.functions.find(
      (f) => f.name === resolvedName
    );

    if (!(symbol && funcInfo)) {
      diagnostics.push(
        createMissingDeclarationDiagnostic({
          checkContext,
          label: "function",
          name: resolvedName,
        })
      );
      continue;
    }

    if (isDeclarationSymbolExported({ fileStructure, symbol })) {
      diagnostics.push(
        createExportedDeclarationDiagnostic({
          checkContext,
          label: "function",
          symbol,
        })
      );
      continue;
    }

    diagnostics.push(
      ...checkSignature({
        funcInfo,
        resolvedName,
        resolvedParamType,
        resolvedReturnType,
        checkContext,
      })
    );
  }

  return diagnostics;
}
