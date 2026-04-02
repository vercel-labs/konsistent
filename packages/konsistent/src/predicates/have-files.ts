import type { PredicateContext } from '../core/context.js';
import { createDiagnostic } from '../core/diagnostics.js';
import type { Diagnostic } from '../core/diagnostics.js';

export function checkHaveFiles(opts: {
  expected: string[];
  context: PredicateContext;
  conventionName?: string;
}): Diagnostic[] {
  const { expected, context, conventionName } = opts;
  const diagnostics: Diagnostic[] = [];

  for (const fileTemplate of expected) {
    const resolved = context.resolveTemplate(fileTemplate);
    if (!context.fileExists(resolved)) {
      diagnostics.push(
        createDiagnostic({
          filePath: context.path,
          predicateName: 'haveFiles',
          message: `Missing required file: ${resolved}`,
          conventionName,
        })
      );
    }
  }

  return diagnostics;
}
