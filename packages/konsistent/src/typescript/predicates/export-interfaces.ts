import type { PredicateContext } from '../../core/context.js';
import { createDiagnostic } from '../../core/diagnostics.js';
import type { Diagnostic, DiagnosticSeverity } from '../../core/diagnostics.js';
import type { ExtendsClauseInfo, FileStructure } from '../types.js';

type ExtendConfig =
  | string
  | { type: string; allowOmissions?: boolean }
  | undefined;

function resolveExtendConfig(opts: {
  extend: ExtendConfig;
  context: PredicateContext;
}): { type: string; allowOmissions: boolean } | undefined {
  const { extend, context } = opts;
  if (!extend) {
    return undefined;
  }
  if (typeof extend === 'string') {
    return { type: context.resolveTemplate(extend), allowOmissions: false };
  }
  return {
    type: context.resolveTemplate(extend.type),
    allowOmissions: extend.allowOmissions ?? false,
  };
}

function matchesExtend(opts: {
  extendsClauses: ExtendsClauseInfo[];
  config: { type: string; allowOmissions: boolean };
}): boolean {
  const { extendsClauses, config } = opts;
  const directMatch = extendsClauses.some((c) => c.name === config.type);
  if (directMatch) {
    return true;
  }
  if (config.allowOmissions) {
    return extendsClauses.some(
      (c) => c.typeArguments.length > 0 && c.typeArguments[0] === config.type
    );
  }
  return false;
}

export function checkExportInterfaces(opts: {
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
          severity,
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
          severity,
        })
      );
      continue;
    }

    const extendConfig = resolveExtendConfig({
      extend: definition.extend,
      context,
    });
    if (
      extendConfig &&
      interfaceInfo &&
      !matchesExtend({
        extendsClauses: interfaceInfo.extends,
        config: extendConfig,
      })
    ) {
      diagnostics.push(
        createDiagnostic({
          filePath: context.path,
          predicateName: 'exportInterfaces',
          message: `Interface "${resolvedName}" must extend "${extendConfig.type}"`,
          conventionName,
          line: interfaceInfo.pos.line,
          column: interfaceInfo.pos.column,
          severity,
        })
      );
    }
  }

  return diagnostics;
}
