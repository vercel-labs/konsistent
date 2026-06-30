import type { PredicateContext } from "../../core/context.js";
import type { Diagnostic, DiagnosticSeverity } from "../../core/diagnostics.js";
import { createDiagnostic } from "../../core/diagnostics.js";
import type { FileStructure } from "../types.js";

function isRelativeOrAbsoluteSpecifier(value: string): boolean {
  return (
    value === "." ||
    value === ".." ||
    value.startsWith("./") ||
    value.startsWith("../") ||
    value.startsWith("/")
  );
}

function isPackageRootSpecifier(value: string): boolean {
  if (isRelativeOrAbsoluteSpecifier(value)) {
    return false;
  }
  if (value.startsWith("@")) {
    const parts = value.split("/");
    return parts.length === 2 && parts[0].length > 1 && parts[1] !== "";
  }
  return !value.includes("/");
}

function doesImportSourceMatch(opts: {
  from: string;
  expected: string;
}): boolean {
  const { from, expected } = opts;
  if (from === expected) {
    return true;
  }
  if (!isPackageRootSpecifier(expected)) {
    return false;
  }
  return from.startsWith(`${expected}/`);
}

export function checkImportFrom(opts: {
  expected: string;
  context: PredicateContext;
  fileStructure: FileStructure;
  conventionName?: string;
  severity?: DiagnosticSeverity;
}): Diagnostic[] {
  const { expected, context, fileStructure, conventionName, severity } = opts;
  const resolvedFrom = context.resolveTemplate(expected);
  const found = fileStructure.importSources.find((source) =>
    doesImportSourceMatch({ from: source.from, expected: resolvedFrom })
  );

  if (found) {
    return [];
  }

  return [
    createDiagnostic({
      filePath: context.path,
      predicateName: "importFrom",
      message: `Missing import from "${resolvedFrom}"`,
      conventionName,
      severity,
    }),
  ];
}
