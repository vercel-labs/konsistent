import type { PredicateContext } from "../../core/context.js";
import type { Diagnostic, DiagnosticSeverity } from "../../core/diagnostics.js";
import { createDiagnostic } from "../../core/diagnostics.js";
import type { ExtendsClauseInfo, FileStructure } from "../types.js";

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
    return;
  }
  if (typeof extend === "string") {
    return { allowOmissions: false, type: context.resolveTemplate(extend) };
  }
  return {
    allowOmissions: extend.allowOmissions ?? false,
    type: context.resolveTemplate(extend.type),
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
    const definition = typeof entry === "string" ? { name: entry } : entry;
    const resolvedName = context.resolveTemplate(definition.name);

    const isExported = fileStructure.exports.some(
      (e) =>
        e.name === resolvedName &&
        (e.kind === "interface" || e.isType || e.kind === "re-export")
    );

    const interfaceInfo = fileStructure.interfaces.find(
      (i) => i.name === resolvedName
    );

    if (!(isExported || interfaceInfo)) {
      diagnostics.push(
        createDiagnostic({
          conventionName,
          filePath: context.path,
          message: `Missing export interface "${resolvedName}"`,
          predicateName: "exportInterfaces",
          severity,
        })
      );
      continue;
    }

    if (!isExported) {
      diagnostics.push(
        createDiagnostic({
          conventionName,
          filePath: context.path,
          message: `Missing export interface "${resolvedName}"`,
          predicateName: "exportInterfaces",
          severity,
        })
      );
      continue;
    }

    const extendConfig = resolveExtendConfig({
      context,
      extend: definition.extend,
    });
    if (
      extendConfig &&
      interfaceInfo &&
      !matchesExtend({
        config: extendConfig,
        extendsClauses: interfaceInfo.extends,
      })
    ) {
      diagnostics.push(
        createDiagnostic({
          column: interfaceInfo.pos.column,
          conventionName,
          filePath: context.path,
          line: interfaceInfo.pos.line,
          message: `Interface "${resolvedName}" must extend "${extendConfig.type}"`,
          predicateName: "exportInterfaces",
          severity,
        })
      );
    }
  }

  return diagnostics;
}
