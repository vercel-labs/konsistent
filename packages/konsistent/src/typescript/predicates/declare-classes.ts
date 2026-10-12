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
import type { ClassInfo, FileStructure } from "../types.js";

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
    return;
  }
  if (typeof extend === "string") {
    return context.resolveTemplate(extend);
  }
  return context.resolveTemplate(extend.type);
}

type ImplementConfig = ExtendConfig[] | undefined;

function resolveImplementTypes(opts: {
  implement: ImplementConfig;
  context: PredicateContext;
}): string[] {
  const { implement, context } = opts;
  if (!implement) {
    return [];
  }
  return implement
    .filter((entry) => entry !== undefined)
    .map((entry) => {
      if (typeof entry === "string") {
        return context.resolveTemplate(entry);
      }
      return context.resolveTemplate(entry.type);
    });
}

function checkClassHeritage(opts: {
  definition: { extend?: ExtendConfig; implement?: ImplementConfig };
  classInfo: ClassInfo;
  resolvedName: string;
  checkContext: DeclarationCheckContext;
}): Diagnostic[] {
  const { definition, classInfo, resolvedName, checkContext } = opts;
  const { context, conventionName, severity } = checkContext;
  const diagnostics: Diagnostic[] = [];

  const resolvedExtend = resolveExtendType({
    context,
    extend: definition.extend,
  });
  if (resolvedExtend && classInfo.extends !== resolvedExtend) {
    diagnostics.push(
      createDiagnostic({
        column: classInfo.pos.column,
        conventionName,
        filePath: context.path,
        line: classInfo.pos.line,
        message: `Class "${resolvedName}" must extend "${resolvedExtend}"`,
        predicateName: checkContext.predicateName,
        severity,
      })
    );
  }

  const resolvedImplements = resolveImplementTypes({
    context,
    implement: definition.implement,
  });
  for (const resolvedImpl of resolvedImplements) {
    if (!classInfo.implements.includes(resolvedImpl)) {
      diagnostics.push(
        createDiagnostic({
          column: classInfo.pos.column,
          conventionName,
          filePath: context.path,
          line: classInfo.pos.line,
          message: `Class "${resolvedName}" must implement "${resolvedImpl}"`,
          predicateName: checkContext.predicateName,
          severity,
        })
      );
    }
  }

  return diagnostics;
}

export function checkDeclareClasses(opts: {
  expected: (
    | string
    | {
        name: string;
        extend?: ExtendConfig;
        implement?: ImplementConfig;
      }
  )[];
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
    predicateName: "declareClasses",
    severity,
  };

  for (const entry of expected) {
    const definition = typeof entry === "string" ? { name: entry } : entry;
    const resolvedName = context.resolveTemplate(definition.name);
    const symbol = findDeclarationSymbol({
      fileStructure,
      kinds: ["class"],
      name: resolvedName,
    });
    const classInfo = fileStructure.classes.find(
      (c) => c.name === resolvedName
    );

    if (!(symbol && classInfo)) {
      diagnostics.push(
        createMissingDeclarationDiagnostic({
          checkContext,
          label: "class",
          name: resolvedName,
        })
      );
      continue;
    }

    if (isDeclarationSymbolExported({ fileStructure, symbol })) {
      diagnostics.push(
        createExportedDeclarationDiagnostic({
          checkContext,
          label: "class",
          symbol,
        })
      );
      continue;
    }

    diagnostics.push(
      ...checkClassHeritage({
        checkContext,
        classInfo,
        definition,
        resolvedName,
      })
    );
  }

  return diagnostics;
}
