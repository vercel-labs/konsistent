import {
  compileImportSourceConstraints,
  doesImportSourceConstraintMatch,
} from "@konsistent/convention";
import type { PredicateContext } from "../../core/context.js";
import type { Diagnostic, DiagnosticSeverity } from "../../core/diagnostics.js";
import { createDiagnostic } from "../../core/diagnostics.js";
import type { FileStructure } from "../types.js";

export type ExactImportSourceKind = "either" | "type" | "value";

function doesImportSourceMatch(opts: {
  from: string;
  expected: string;
}): boolean {
  const { from, expected } = opts;
  if (expected.endsWith("/*")) {
    const prefix = expected.slice(0, -2);
    return from.startsWith(`${prefix}/`);
  }
  return from === expected;
}

export function checkImportSourceExact(opts: {
  expected: string | string[];
  importKind?: ExactImportSourceKind;
  predicateName?: string;
  selectorSyntax?: boolean;
  context: PredicateContext;
  fileStructure: FileStructure;
  conventionName?: string;
  severity?: DiagnosticSeverity;
}): Diagnostic[] {
  const {
    expected,
    importKind = "value",
    predicateName = "importValuesFrom",
    selectorSyntax = true,
    context,
    fileStructure,
    conventionName,
    severity,
  } = opts;
  const diagnostics: Diagnostic[] = [];
  const resolvedExpected =
    typeof expected === "string"
      ? resolveConfiguredSource({ source: expected, context, selectorSyntax })
      : expected.map((source) =>
          resolveConfiguredSource({ source, context, selectorSyntax })
        );

  if (selectorSyntax) {
    const compiled = compileImportSourceConstraints({
      expected: resolvedExpected,
    });
    if (!compiled.success) {
      throw new Error(compiled.error);
    }

    for (const constraint of compiled.constraints) {
      const found = fileStructure.importSources.find(
        (importSource) =>
          (importKind === "either" ||
            importSource.isType === (importKind === "type")) &&
          doesImportSourceConstraintMatch({
            source: importSource.from,
            constraint,
          })
      );

      if (found) {
        continue;
      }

      diagnostics.push(
        createDiagnostic({
          filePath: context.path,
          predicateName,
          message: `Missing ${importKind === "type" ? "type import" : "import"} from "${constraint.source}"`,
          conventionName,
          severity,
        })
      );
    }
    return diagnostics;
  }

  const expectedSources =
    typeof resolvedExpected === "string"
      ? [resolvedExpected]
      : resolvedExpected;

  for (const source of expectedSources) {
    const found = fileStructure.importSources.find(
      (importSource) =>
        (importKind === "either" ||
          importSource.isType === (importKind === "type")) &&
        doesImportSourceMatch({
          from: importSource.from,
          expected: source,
        })
    );

    if (found) {
      continue;
    }

    diagnostics.push(
      createDiagnostic({
        filePath: context.path,
        predicateName,
        message: `Missing ${importKind === "type" ? "type import" : "import"} from "${source}"`,
        conventionName,
        severity,
      })
    );
  }

  return diagnostics;
}

function resolveConfiguredSource(opts: {
  source: string;
  context: PredicateContext;
  selectorSyntax: boolean;
}): string {
  if (opts.selectorSyntax && opts.source.startsWith("!")) {
    return `!${opts.context.resolveTemplate(opts.source.slice(1))}`;
  }
  return opts.context.resolveTemplate(opts.source);
}
