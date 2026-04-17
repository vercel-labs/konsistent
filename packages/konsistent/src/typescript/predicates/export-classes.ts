import type { PredicateContext } from '../../core/context.js';
import { createDiagnostic } from '../../core/diagnostics.js';
import type { Diagnostic, DiagnosticSeverity } from '../../core/diagnostics.js';
import type { FileStructure } from '../types.js';

type ExtendConfig =
  | string
  | { type: string; allowOmissions?: boolean }
  | undefined;

function resolveExtendType(opts: {
  extend: ExtendConfig;
  context: PredicateContext;
}): string | undefined {
  const { extend, context } = opts;
  if (!extend) {
    return undefined;
  }
  if (typeof extend === 'string') {
    return context.resolveTemplate(extend);
  }
  return context.resolveTemplate(extend.type);
}

export function checkExportClasses(opts: {
  expected: (string | { name: string; extend?: ExtendConfig })[];
  context: PredicateContext;
  fileStructure: FileStructure;
  conventionName?: string;
  severity?: DiagnosticSeverity;
}): Diagnostic[] {
  const { expected, context, fileStructure, conventionName, severity } = opts;
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
          severity,
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
          severity,
        })
      );
      continue;
    }

    const resolvedExtend = resolveExtendType({
      extend: definition.extend,
      context,
    });
    if (resolvedExtend && classInfo && classInfo.extends !== resolvedExtend) {
      diagnostics.push(
        createDiagnostic({
          filePath: context.path,
          predicateName: 'exportClasses',
          message: `Class "${resolvedName}" must extend "${resolvedExtend}"`,
          conventionName,
          line: classInfo.pos.line,
          column: classInfo.pos.column,
          severity,
        })
      );
    }
  }

  return diagnostics;
}
