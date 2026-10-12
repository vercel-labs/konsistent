import type { PredicateContext } from "../../core/context.js";
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
  context: PredicateContext;
  conventionName?: string;
  severity?: DiagnosticSeverity;
}): Diagnostic[] {
  const {
    funcInfo,
    resolvedName,
    resolvedParamType,
    resolvedParamTypes,
    resolvedReturnType,
    context,
    conventionName,
    severity,
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
          conventionName,
          filePath: context.path,
          line: funcInfo.pos.line,
          message: `Function "${resolvedName}" must receive a parameter of type "${resolvedParamType}"`,
          predicateName: "exportFunctions",
          severity,
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
          conventionName,
          filePath: context.path,
          line: funcInfo.pos.line,
          message: `Function "${resolvedName}" parameter ${index + 1} must be of type "${expectedType}"`,
          predicateName: "exportFunctions",
          severity,
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
        conventionName,
        filePath: context.path,
        line: funcInfo.pos.line,
        message: `Function "${resolvedName}" must return value of type "${resolvedReturnType}"`,
        predicateName: "exportFunctions",
        severity,
      })
    );
  }

  return diagnostics;
}

export function checkExportFunctions(opts: {
  expected: (string | FunctionDef)[];
  context: PredicateContext;
  fileStructure: FileStructure;
  conventionName?: string;
  severity?: DiagnosticSeverity;
}): Diagnostic[] {
  const { expected, context, fileStructure, conventionName, severity } = opts;
  const diagnostics: Diagnostic[] = [];

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

    const isExported = fileStructure.exports.some(
      (e) => e.name === resolvedName && !e.isType
    );
    const funcInfo = fileStructure.functions.find(
      (f) => f.name === resolvedName
    );

    if (!(isExported && funcInfo)) {
      diagnostics.push(
        createDiagnostic({
          conventionName,
          filePath: context.path,
          message: `Missing export function "${resolvedName}"`,
          predicateName: "exportFunctions",
          severity,
        })
      );
      continue;
    }

    diagnostics.push(
      ...checkSignature({
        context,
        conventionName,
        funcInfo,
        resolvedName,
        resolvedParamType,
        resolvedParamTypes,
        resolvedReturnType,
        severity,
      })
    );
  }

  return diagnostics;
}
