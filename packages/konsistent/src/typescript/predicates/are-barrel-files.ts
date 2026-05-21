import type { PredicateContext } from "../../core/context.js";
import type { Diagnostic, DiagnosticSeverity } from "../../core/diagnostics.js";
import { createDiagnostic } from "../../core/diagnostics.js";
import type { FileStructure, NonBarrelStatementInfo } from "../types.js";

const MESSAGES: Record<NonBarrelStatementInfo["kind"], string> = {
  declaration: "Barrel file must not contain declarations",
  expression: "Barrel file must not contain top-level expression statements",
  "default-expression":
    "Barrel file default export must re-export an imported identifier",
  "named-export-local": "Barrel file must only re-export imported identifiers",
  "export-equals": "Barrel file must not use `export =`",
};

export function checkAreBarrelFiles(opts: {
  expected: boolean;
  context: PredicateContext;
  fileStructure: FileStructure;
  conventionName?: string;
  severity?: DiagnosticSeverity;
}): Diagnostic[] {
  const { expected, context, fileStructure, conventionName, severity } = opts;
  if (!expected) {
    return [];
  }

  return fileStructure.nonBarrelStatements.map((entry) =>
    createDiagnostic({
      filePath: context.path,
      predicateName: "areBarrelFiles",
      message: MESSAGES[entry.kind],
      conventionName,
      line: entry.pos.line,
      column: entry.pos.column,
      severity,
    })
  );
}
