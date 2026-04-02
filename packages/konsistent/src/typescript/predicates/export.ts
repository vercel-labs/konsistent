import type { PredicateContext } from '../../core/context.js';
import { createDiagnostic } from '../../core/diagnostics.js';
import type { Diagnostic } from '../../core/diagnostics.js';
import type { FileStructure } from '../types.js';

export function checkExport(opts: {
  expected: (string | { name: string })[];
  context: PredicateContext;
  fileStructure: FileStructure;
  conventionName?: string;
}): Diagnostic[] {
  const { expected, context, fileStructure, conventionName } = opts;
  const diagnostics: Diagnostic[] = [];

  for (const entry of expected) {
    const definition = typeof entry === 'string' ? { name: entry } : entry;
    const resolvedName = context.resolveTemplate(definition.name);

    const found = fileStructure.exports.some(
      (e) => e.name === resolvedName && !e.isType
    );

    if (!found) {
      diagnostics.push(
        createDiagnostic({
          filePath: context.path,
          predicateName: 'export',
          message: `Missing export "${resolvedName}"`,
          conventionName,
        })
      );
    }
  }

  return diagnostics;
}
