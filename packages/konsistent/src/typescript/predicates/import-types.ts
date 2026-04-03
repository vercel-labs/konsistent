import type { PredicateContext } from '../../core/context.js';
import { createDiagnostic } from '../../core/diagnostics.js';
import type { Diagnostic, DiagnosticSeverity } from '../../core/diagnostics.js';
import type { FileStructure } from '../types.js';

export function checkImportTypes(opts: {
  expected: (string | { name: string; from?: string })[];
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
    const resolvedFrom = definition.from
      ? context.resolveTemplate(definition.from)
      : undefined;

    const found = fileStructure.imports.some(
      (i) =>
        i.name === resolvedName &&
        i.isType &&
        (resolvedFrom === undefined || i.from === resolvedFrom)
    );

    if (!found) {
      diagnostics.push(
        createDiagnostic({
          filePath: context.path,
          predicateName: 'importTypes',
          message: `Missing import type "${resolvedName}"`,
          conventionName,
          severity,
        })
      );
    }
  }

  return diagnostics;
}
