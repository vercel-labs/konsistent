import type { PredicateContext } from "../../core/context.js";
import {
  createExportedDeclarationDiagnostic,
  createMissingDeclarationDiagnostic,
  type DeclarationCheckContext,
  findDeclarationSymbol,
  isDeclarationSymbolExported,
} from "../../core/declaration-utils.js";
import type { Diagnostic, DiagnosticSeverity } from "../../core/diagnostics.js";
import { createDiagnostic } from "../../core/diagnostics.js";
import type {
  FileStructure,
  FunctionInfo,
  TypeAnnotationInfo,
} from "../types.js";

interface FunctionDef {
  name: string;
  receiveParamOfType?: string;
  receiveParamsOfTypes?: string[];
  returnValueOfType?: string;
}

function typeMatches(opts: {
  actual: TypeAnnotationInfo | undefined;
  expected: string;
}): boolean {
  const { actual, expected } = opts;
  return actual?.text === expected || actual?.baseName === expected;
}

function checkSignature(opts: {
  funcInfo: FunctionInfo;
  resolvedName: string;
  resolvedParamType: string | undefined;
  resolvedParamTypes: string[] | undefined;
  resolvedReturnType: string | undefined;
  checkContext: DeclarationCheckContext;
}): Diagnostic[] {
  const {
    funcInfo,
    resolvedName,
    resolvedParamType,
    resolvedParamTypes,
    resolvedReturnType,
    checkContext,
  } = opts;
  const diagnostics: Diagnostic[] = [];

  if (resolvedParamType) {
    const hasParam = funcInfo.params.some((p) =>
      typeMatches({ actual: p.typeName, expected: resolvedParamType })
    );
    if (!hasParam) {
      diagnostics.push(
        createDiagnostic({
          column: funcInfo.pos.column,
          conventionName: checkContext.conventionName,
          filePath: checkContext.context.path,
          line: funcInfo.pos.line,
          message: `Function "${resolvedName}" must receive a parameter of type "${resolvedParamType}"`,
          predicateName: checkContext.predicateName,
          severity: checkContext.severity,
        })
      );
    }
  }

  if (resolvedParamTypes) {
    for (const [index, expectedType] of resolvedParamTypes.entries()) {
      const param = funcInfo.params[index];
      if (typeMatches({ actual: param?.typeName, expected: expectedType })) {
        continue;
      }
      diagnostics.push(
        createDiagnostic({
          column: funcInfo.pos.column,
          conventionName: checkContext.conventionName,
          filePath: checkContext.context.path,
          line: funcInfo.pos.line,
          message: `Function "${resolvedName}" parameter ${index + 1} must be of type "${expectedType}"`,
          predicateName: checkContext.predicateName,
          severity: checkContext.severity,
        })
      );
    }
  }

  if (
    resolvedReturnType &&
    !typeMatches({ actual: funcInfo.returnType, expected: resolvedReturnType })
  ) {
    diagnostics.push(
      createDiagnostic({
        column: funcInfo.pos.column,
        conventionName: checkContext.conventionName,
        filePath: checkContext.context.path,
        line: funcInfo.pos.line,
        message: `Function "${resolvedName}" must return value of type "${resolvedReturnType}"`,
        predicateName: checkContext.predicateName,
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
    const resolvedParamTypes = definition.receiveParamsOfTypes?.map((type) =>
      context.resolveTemplate(type)
    );
    const resolvedReturnType = definition.returnValueOfType
      ? context.resolveTemplate(definition.returnValueOfType)
      : undefined;

    const symbol = findDeclarationSymbol({
      fileStructure,
      kinds: ["function"],
      name: resolvedName,
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
        checkContext,
        funcInfo,
        resolvedName,
        resolvedParamType,
        resolvedParamTypes,
        resolvedReturnType,
      })
    );
  }

  return diagnostics;
}
