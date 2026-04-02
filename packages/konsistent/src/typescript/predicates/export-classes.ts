import type { PredicateContext } from '../../core/context.js';
import { createDiagnostic } from '../../core/diagnostics.js';
import type { Diagnostic } from '../../core/diagnostics.js';
import type { FileStructure } from '../types.js';

export function checkExportClasses(opts: {
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
        (e.kind === 'class' || e.kind === 're-export')
    );

    const classInfo = fileStructure.classes.find(
      (c) => c.name === resolvedName
    );

    if (!isExported && !classInfo) {
      diagnostics.push(
        createDiagnostic({
          filePath: context.path,
          predicateName: 'exportClasses',
          message: `Missing export class "${resolvedName}"`,
          conventionName,
        })
      );
      continue;
    }

    if (!isExported) {
      diagnostics.push(
        createDiagnostic({
          filePath: context.path,
          predicateName: 'exportClasses',
          message: `Missing export class "${resolvedName}"`,
          conventionName,
        })
      );
      continue;
    }

    if (definition.extend && classInfo) {
      const resolvedExtend = context.resolveTemplate(definition.extend);
      if (classInfo.extends !== resolvedExtend) {
        diagnostics.push(
          createDiagnostic({
            filePath: context.path,
            predicateName: 'exportClasses',
            message: `Class "${resolvedName}" must extend "${resolvedExtend}"`,
            conventionName,
            line: classInfo.pos.line,
            column: classInfo.pos.column,
          })
        );
      }
    }
  }

  return diagnostics;
}
