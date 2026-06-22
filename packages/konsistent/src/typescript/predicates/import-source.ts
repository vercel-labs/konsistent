import type { PredicateContext } from "../../core/context.js";
import type { Diagnostic, DiagnosticSeverity } from "../../core/diagnostics.js";
import { createDiagnostic } from "../../core/diagnostics.js";
import type { FileStructure, ImportSourceInfo } from "../types.js";

type ImportSourceGroup = "currentDir" | "parents" | "externals";
type ImportSourceKind = "type" | "value";

function isImportSourceInGroup(opts: {
  from: string;
  group: ImportSourceGroup;
}): boolean {
  const { from, group } = opts;
  const isCurrentDir = from === "." || from.startsWith("./");
  const isParent = from === ".." || from.startsWith("../");

  if (group === "currentDir") {
    return isCurrentDir;
  }
  if (group === "parents") {
    return isParent;
  }
  return !(isCurrentDir || isParent);
}

function getGroupLabel(group: ImportSourceGroup): string {
  if (group === "currentDir") {
    return "current directory";
  }
  if (group === "parents") {
    return "parent directories";
  }
  return "external packages";
}

function findImportSource(opts: {
  fileStructure: FileStructure;
  group: ImportSourceGroup;
  importKind: ImportSourceKind;
}): ImportSourceInfo | undefined {
  const { fileStructure, group, importKind } = opts;
  const isType = importKind === "type";
  return fileStructure.importSources.find(
    (source) =>
      isImportSourceInGroup({ from: source.from, group }) &&
      source.isType === isType
  );
}

export function checkImportSource(opts: {
  expected: boolean;
  predicateName: string;
  group: ImportSourceGroup;
  importKind: ImportSourceKind;
  context: PredicateContext;
  fileStructure: FileStructure;
  conventionName?: string;
  severity?: DiagnosticSeverity;
}): Diagnostic[] {
  const {
    expected,
    predicateName,
    group,
    importKind,
    context,
    fileStructure,
    conventionName,
    severity,
  } = opts;
  const found = findImportSource({ fileStructure, group, importKind });
  const label = getGroupLabel(group);
  const noun = importKind === "type" ? "type import" : "import";
  const capitalizedNoun = importKind === "type" ? "Type import" : "Import";

  if (expected && !found) {
    return [
      createDiagnostic({
        filePath: context.path,
        predicateName,
        message: `Missing ${noun} from ${label}`,
        conventionName,
        severity,
      }),
    ];
  }

  if (!expected && found) {
    return [
      createDiagnostic({
        filePath: context.path,
        predicateName,
        message: `${capitalizedNoun} from ${label} is not allowed`,
        conventionName,
        line: found.pos.line,
        column: found.pos.column,
        severity,
      }),
    ];
  }

  return [];
}
