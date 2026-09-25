import type { PredicateContext } from "../../core/context.js";
import type { Diagnostic, DiagnosticSeverity } from "../../core/diagnostics.js";
import type { FileStructure } from "../types.js";
import { checkModuleSourceExact } from "./module-source.js";

export type ExactImportSourceKind = "either" | "type" | "value";

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
  return checkModuleSourceExact({
    ...opts,
    direction: "import",
    kind: opts.importKind ?? "value",
    predicateName: opts.predicateName ?? "importValuesFrom",
  });
}
