import type { PredicateContext } from "../../core/context.js";
import {
  createExportedDeclarationDiagnostic,
  createMissingDeclarationDiagnostic,
  type DeclarationCheckContext,
  findDeclarationSymbol,
  isDeclarationSymbolExported,
} from "../../core/declaration-utils.js";
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

export function checkDeclareInterfaces(opts: {
  expected: (string | { name: string; extend?: ExtendConfig })[];
  context: PredicateContext;
  fileStructure: FileStructure;
  conventionName?: string;
  severity?: DiagnosticSeverity;
}): Diagnostic[] {
  const { expected, context, fileStructure, conventionName, severity } = opts;
  const diagnostics: Diagnostic[] = [];
  const checkContext: DeclarationCheckContext = {
    context,
    conventionName,
    predicateName: "declareInterfaces",
    severity,
  };

  for (const entry of expected) {
    const definition = typeof entry === "string" ? { name: entry } : entry;
    const resolvedName = context.resolveTemplate(definition.name);
    const symbol = findDeclarationSymbol({
      fileStructure,
      kinds: ["interface"],
      name: resolvedName,
    });
    const interfaceInfo = fileStructure.interfaces.find(
      (i) => i.name === resolvedName
    );

    if (!(symbol && interfaceInfo)) {
      diagnostics.push(
        createMissingDeclarationDiagnostic({
          checkContext,
          label: "interface",
          name: resolvedName,
        })
      );
      continue;
    }

    if (isDeclarationSymbolExported({ fileStructure, symbol })) {
      diagnostics.push(
        createExportedDeclarationDiagnostic({
          checkContext,
          label: "interface",
          symbol,
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
          predicateName: "declareInterfaces",
          severity,
        })
      );
    }
  }

  return diagnostics;
}
