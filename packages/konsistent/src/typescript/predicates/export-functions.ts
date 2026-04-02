import type { PredicateContext } from '../../core/context.js';
import { createDiagnostic } from '../../core/diagnostics.js';
import type { Diagnostic } from '../../core/diagnostics.js';
import type { FileStructure } from '../types.js';

export function checkExportFunctions(opts: {
  expected: (
    | string
    | {
        name: string;
        receiveParamOfType?: string;
        returnValueOfType?: string;
      }
  )[];
  context: PredicateContext;
  fileStructure: FileStructure;
  conventionName?: string;
}): Diagnostic[] {
  const { expected, context, fileStructure, conventionName } = opts;
  const diagnostics: Diagnostic[] = [];

  for (const entry of expected) {
    const definition =
      typeof entry === 'string'
        ? {
            name: entry,
            receiveParamOfType: undefined,
            returnValueOfType: undefined,
          }
        : entry;

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

    if (!isExported || !funcInfo) {
      diagnostics.push(
        createDiagnostic({
          filePath: context.path,
          predicateName: 'exportFunctions',
          message: `Missing export function "${resolvedName}"`,
          conventionName,
        })
      );
      continue;
    }

    if (resolvedParamType) {
      const hasParam = funcInfo.params.some(
        (p) => p.typeName === resolvedParamType
      );
      if (!hasParam) {
        diagnostics.push(
          createDiagnostic({
            filePath: context.path,
            predicateName: 'exportFunctions',
            message: `Function "${resolvedName}" must receive a parameter of type "${resolvedParamType}"`,
            conventionName,
            line: funcInfo.pos.line,
            column: funcInfo.pos.column,
          })
        );
      }
    }

    if (resolvedReturnType && funcInfo.returnType !== resolvedReturnType) {
      diagnostics.push(
        createDiagnostic({
          filePath: context.path,
          predicateName: 'exportFunctions',
          message: `Function "${resolvedName}" must return value of type "${resolvedReturnType}"`,
          conventionName,
          line: funcInfo.pos.line,
          column: funcInfo.pos.column,
        })
      );
    }
  }

  return diagnostics;
}
