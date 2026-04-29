import type { PredicateContext } from "../../core/context.js";
import type { Diagnostic, DiagnosticSeverity } from "../../core/diagnostics.js";
import { createDiagnostic } from "../../core/diagnostics.js";
import type { FileStructure, FunctionInfo } from "../types.js";

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
  context: PredicateContext;
  conventionName?: string;
  severity?: DiagnosticSeverity;
}): Diagnostic[] {
  const {
    funcInfo,
    resolvedName,
    resolvedParamType,
    resolvedReturnType,
    context,
    conventionName,
    severity,
  } = opts;
  const diagnostics: Diagnostic[] = [];

  if (resolvedParamType) {
    const hasParam = funcInfo.params.some(
      (p) => p.typeName === resolvedParamType
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

  if (resolvedReturnType && funcInfo.returnType !== resolvedReturnType) {
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
        resolvedReturnType,
        context,
        conventionName,
        severity,
      })
    );
  }

  return diagnostics;
}
