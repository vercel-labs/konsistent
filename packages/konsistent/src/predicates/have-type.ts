import type { PredicateContext } from "../core/context.js";
import type { Diagnostic, DiagnosticSeverity } from "../core/diagnostics.js";
import { createDiagnostic } from "../core/diagnostics.js";
import type { FileSystem } from "../core/filesystem.js";

export function checkHaveType(opts: {
  expected: "file" | "directory";
  context: PredicateContext;
  fileSystem: FileSystem;
  conventionName?: string;
  severity?: DiagnosticSeverity;
}): Diagnostic[] {
  const { expected, context, fileSystem, conventionName, severity } = opts;
  const isDir = fileSystem.isDirectory(context.path);
  const isFile = fileSystem.isFile(context.path);

  if (expected === "file" && !isFile) {
    return [
      createDiagnostic({
        filePath: context.path,
        predicateName: "haveType",
        message: isDir
          ? "Expected a file but found a directory"
          : "Expected a file but path does not exist",
        conventionName,
        severity,
      }),
    ];
  }

  if (expected === "directory" && !isDir) {
    return [
      createDiagnostic({
        filePath: context.path,
        predicateName: "haveType",
        message: isFile
          ? "Expected a directory but found a file"
          : "Expected a directory but path does not exist",
        conventionName,
        severity,
      }),
    ];
  }

  return [];
}
