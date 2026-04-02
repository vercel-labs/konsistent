import type { PredicateContext } from '../../core/context.js';
import { createDiagnostic } from '../../core/diagnostics.js';
import type { Diagnostic } from '../../core/diagnostics.js';
import type { FileStructure } from '../types.js';

export function checkExportInterfaces(opts: {
  expected: (string | { name: string; extend?: string })[];
  context: PredicateContext;
  fileStructure: FileStructure;
  conventionName?: string;
}): Diagnostic[] {
  const { expected, context, fileStructure, conventionName } = opts;
  const diagnostics: Diagnostic[] = [];

  for (const entry of expected) {
    const definition = typeof entry === 'string' ? { name: entry } : entry;
    const resolvedName = context.resolveTemplate(definition.name);

    const isExported = fileStructure.exports.some(
      (e) =>
        e.name === resolvedName &&
        (e.kind === 'interface' || e.isType || e.kind === 're-export')
    );

    const interfaceInfo = fileStructure.interfaces.find(
      (i) => i.name === resolvedName
    );

    if (!isExported && !interfaceInfo) {
      diagnostics.push(
        createDiagnostic({
          filePath: context.path,
          predicateName: 'exportInterfaces',
          message: `Missing export interface "${resolvedName}"`,
          conventionName,
        })
      );
      continue;
    }

    if (!isExported) {
      diagnostics.push(
        createDiagnostic({
          filePath: context.path,
          predicateName: 'exportInterfaces',
          message: `Missing export interface "${resolvedName}"`,
          conventionName,
        })
      );
      continue;
    }

    if (definition.extend && interfaceInfo) {
      const resolvedExtend = context.resolveTemplate(definition.extend);
      if (!interfaceInfo.extends.includes(resolvedExtend)) {
        diagnostics.push(
          createDiagnostic({
            filePath: context.path,
            predicateName: 'exportInterfaces',
            message: `Interface "${resolvedName}" must extend "${resolvedExtend}"`,
            conventionName,
            line: interfaceInfo.pos.line,
            column: interfaceInfo.pos.column,
          })
        );
      }
    }
  }

  return diagnostics;
}
