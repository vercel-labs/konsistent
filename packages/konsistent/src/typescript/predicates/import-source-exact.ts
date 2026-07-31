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

export function checkExactImportSource(opts: {
  expected: string | string[];
  importKind?: ExactImportSourceKind;
  predicateName?: string;
  context: PredicateContext;
  fileStructure: FileStructure;
  conventionName?: string;
  severity?: DiagnosticSeverity;
}): Diagnostic[] {
  const {
    expected,
    importKind = "value",
    predicateName = "importValuesFrom",
    context,
    fileStructure,
    conventionName,
    severity,
  } = opts;
  const diagnostics: Diagnostic[] = [];
  const expectedSources = typeof expected === "string" ? [expected] : expected;

  for (const source of expectedSources) {
    const resolvedFrom = context.resolveTemplate(source);
    const found = fileStructure.importSources.find(
      (importSource) =>
        (importKind === "either" ||
          importSource.isType === (importKind === "type")) &&
        doesImportSourceMatch({
          from: importSource.from,
          expected: resolvedFrom,
        })
    );

    if (found) {
      continue;
    }

    diagnostics.push(
      createDiagnostic({
        filePath: context.path,
        predicateName,
        message: `Missing ${importKind === "type" ? "type import" : "import"} from "${resolvedFrom}"`,
        conventionName,
        severity,
      })
    );
  }

  return diagnostics;
}
