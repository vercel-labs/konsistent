import {
  compileImportSourceConstraints,
  doesImportSourceConstraintMatch,
} from "@konsistent/convention";
import type { PredicateContext } from "../../core/context.js";
import type { Diagnostic, DiagnosticSeverity } from "../../core/diagnostics.js";
import { createDiagnostic } from "../../core/diagnostics.js";
import type { FileStructure, ImportSourceInfo } from "../types.js";

type ModuleSourceKind = "either" | "type" | "value";
type ModuleSourceGroup = "currentDir" | "parents" | "externals";
type ModuleSourceDirection = "import" | "export";

function getSources(opts: {
  fileStructure: FileStructure;
  direction: ModuleSourceDirection;
}): ImportSourceInfo[] {
  if (opts.direction === "import") {
    return opts.fileStructure.importSources;
  }
  return opts.fileStructure.exports.flatMap((entry) =>
    entry.kind === "re-export" && entry.from !== undefined
      ? [{ from: entry.from, isType: entry.isType, pos: entry.pos }]
      : []
  );
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

function doesSourceMatch(opts: { from: string; expected: string }): boolean {
  if (opts.expected.endsWith("/*")) {
    const prefix = opts.expected.slice(0, -2);
    return opts.from.startsWith(`${prefix}/`);
  }
  return opts.from === opts.expected;
}

export function checkModuleSourceExact(opts: {
  expected: string | string[];
  direction: ModuleSourceDirection;
  kind: ModuleSourceKind;
  predicateName: string;
  selectorSyntax?: boolean;
  context: PredicateContext;
  fileStructure: FileStructure;
  conventionName?: string;
  severity?: DiagnosticSeverity;
}): Diagnostic[] {
  const { direction, kind, context, fileStructure, predicateName } = opts;
  const selectorSyntax = opts.selectorSyntax ?? true;
  const resolvedExpected =
    typeof opts.expected === "string"
      ? resolveConfiguredSource({
          source: opts.expected,
          context,
          selectorSyntax,
        })
      : opts.expected.map((source) =>
          resolveConfiguredSource({ source, context, selectorSyntax })
        );
  const sources = getSources({ fileStructure, direction }).filter(
    (source) => kind === "either" || source.isType === (kind === "type")
  );
  const noun = `${kind === "type" ? "type " : ""}${direction}`;
  const diagnostics: Diagnostic[] = [];

  if (selectorSyntax) {
    const compiled = compileImportSourceConstraints({
      expected: resolvedExpected,
      sourceLabel: direction === "import" ? "Import" : "Export",
    });
    if (!compiled.success) {
      throw new Error(compiled.error);
    }
    for (const constraint of compiled.constraints) {
      if (
        sources.some((source) =>
          doesImportSourceConstraintMatch({ source: source.from, constraint })
        )
      ) {
        continue;
      }
      diagnostics.push(
        createDiagnostic({
          filePath: context.path,
          predicateName,
          message: `Missing ${noun} from "${constraint.source}"`,
          conventionName: opts.conventionName,
          severity: opts.severity,
        })
      );
    }
    return diagnostics;
  }

  const expectedSources =
    typeof resolvedExpected === "string"
      ? [resolvedExpected]
      : resolvedExpected;
  for (const expected of expectedSources) {
    if (
      sources.some((source) => doesSourceMatch({ from: source.from, expected }))
    ) {
      continue;
    }
    diagnostics.push(
      createDiagnostic({
        filePath: context.path,
        predicateName,
        message: `Missing ${noun} from "${expected}"`,
        conventionName: opts.conventionName,
        severity: opts.severity,
      })
    );
  }
  return diagnostics;
}

function isSourceInGroup(opts: {
  from: string;
  group: ModuleSourceGroup;
}): boolean {
  const isCurrentDir = opts.from === "." || opts.from.startsWith("./");
  const isParent = opts.from === ".." || opts.from.startsWith("../");
  if (opts.group === "currentDir") {
    return isCurrentDir;
  }
  if (opts.group === "parents") {
    return isParent;
  }
  return !(isCurrentDir || isParent);
}

function getGroupLabel(group: ModuleSourceGroup): string {
  if (group === "currentDir") {
    return "current directory";
  }
  if (group === "parents") {
    return "parent directories";
  }
  return "external packages";
}

export function checkModuleSourceGroup(opts: {
  expected: boolean;
  direction: ModuleSourceDirection;
  kind: "type" | "value";
  predicateName: string;
  group: ModuleSourceGroup;
  context: PredicateContext;
  fileStructure: FileStructure;
  conventionName?: string;
  severity?: DiagnosticSeverity;
}): Diagnostic[] {
  const found = getSources(opts).find(
    (source) =>
      source.isType === (opts.kind === "type") &&
      isSourceInGroup({ from: source.from, group: opts.group })
  );
  const noun = `${opts.kind === "type" ? "type " : ""}${opts.direction}`;
  const label = getGroupLabel(opts.group);
  if (opts.expected && !found) {
    return [
      createDiagnostic({
        filePath: opts.context.path,
        predicateName: opts.predicateName,
        message: `Missing ${noun} from ${label}`,
        conventionName: opts.conventionName,
        severity: opts.severity,
      }),
    ];
  }
  if (!opts.expected && found) {
    return [
      createDiagnostic({
        filePath: opts.context.path,
        predicateName: opts.predicateName,
        message: `${noun[0]?.toUpperCase()}${noun.slice(1)} from ${label} is not allowed`,
        conventionName: opts.conventionName,
        line: found.pos.line,
        column: found.pos.column,
        severity: opts.severity,
      }),
    ];
  }
  return [];
}
