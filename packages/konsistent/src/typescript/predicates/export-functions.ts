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
          filePath: context.path,
          predicateName: "exportFunctions",
          message: `Function "${resolvedName}" must receive a parameter of type "${resolvedParamType}"`,
          conventionName,
          line: funcInfo.pos.line,
          column: funcInfo.pos.column,
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
          filePath: context.path,
          predicateName: "exportFunctions",
          message: `Function "${resolvedName}" parameter ${index + 1} must be of type "${expectedType}"`,
          conventionName,
          line: funcInfo.pos.line,
          column: funcInfo.pos.column,
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
        filePath: context.path,
        predicateName: "exportFunctions",
        message: `Function "${resolvedName}" must return value of type "${resolvedReturnType}"`,
        conventionName,
        line: funcInfo.pos.line,
        column: funcInfo.pos.column,
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
          filePath: context.path,
          predicateName: "exportFunctions",
          message: `Missing export function "${resolvedName}"`,
          conventionName,
          severity,
        })
      );
      continue;
    }

    diagnostics.push(
      ...checkSignature({
        funcInfo,
        resolvedName,
        resolvedParamType,
        resolvedParamTypes,
        resolvedReturnType,
        context,
        conventionName,
        severity,
      })
    );
  }

  return diagnostics;
}
