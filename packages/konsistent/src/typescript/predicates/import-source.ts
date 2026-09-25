import type { PredicateContext } from "../../core/context.js";
import type { Diagnostic, DiagnosticSeverity } from "../../core/diagnostics.js";
import type { FileStructure } from "../types.js";
import { checkModuleSourceGroup } from "./module-source.js";

export function checkImportSource(opts: {
  expected: boolean;
  predicateName: string;
  group: "currentDir" | "parents" | "externals";
  importKind: "type" | "value";
  context: PredicateContext;
  fileStructure: FileStructure;
  conventionName?: string;
  severity?: DiagnosticSeverity;
}): Diagnostic[] {
  return checkModuleSourceGroup({
    ...opts,
    direction: "import",
    kind: opts.importKind,
  });
}
