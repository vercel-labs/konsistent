import { basename, dirname, join, posix } from "node:path";
import type {
  ConfigV1,
  MustBlockV1,
  MustPredicatesV1,
} from "../config/schema.js";
import { checkHaveFiles } from "../predicates/have-files.js";
import { checkHaveType } from "../predicates/have-type.js";
import { parseFileStructure } from "../typescript/parser.js";
import { checkAreBarrelFiles } from "../typescript/predicates/are-barrel-files.js";
import { checkDeclareClasses } from "../typescript/predicates/declare-classes.js";
import { checkDeclareConstants } from "../typescript/predicates/declare-constants.js";
import { checkDeclareFunctions } from "../typescript/predicates/declare-functions.js";
import { checkDeclareInterfaces } from "../typescript/predicates/declare-interfaces.js";
import { checkDeclareTypes } from "../typescript/predicates/declare-types.js";
import { checkExportClasses } from "../typescript/predicates/export-classes.js";
import { checkExportConstants } from "../typescript/predicates/export-constants.js";
import { checkExportFunctions } from "../typescript/predicates/export-functions.js";
import { checkExportInterfaces } from "../typescript/predicates/export-interfaces.js";
import { checkExportTypes } from "../typescript/predicates/export-types.js";
import { checkExportValues } from "../typescript/predicates/export-values.js";
import { checkImportFrom } from "../typescript/predicates/import-from.js";
import { checkImportSource } from "../typescript/predicates/import-source.js";
import { checkImportTypes } from "../typescript/predicates/import-types.js";
import { checkImportValues } from "../typescript/predicates/import-values.js";
import { checkUseDeclarationOrder } from "../typescript/predicates/use-declaration-order.js";
import type { FileStructure } from "../typescript/types.js";
import { toCamelCase, toPascalCase } from "./case-utils.js";
import type { PredicateContext } from "./context.js";
import { generateConventionName } from "./convention-name.js";
import type { Diagnostic, DiagnosticSeverity } from "./diagnostics.js";
import { createDiagnostic } from "./diagnostics.js";
import type { FileSystem } from "./filesystem.js";
import type { MatchedPath } from "./path-matcher.js";
import { matchPaths } from "./path-matcher.js";
import { PlaceholderValue } from "./placeholder.js";
import {
  parsePlaceholderConstraint,
  validatePlaceholderConstraint,
} from "./placeholder-constraint.js";
import { resolveTemplate } from "./template.js";

interface CaseMaps {
  camelToKebabMap?: Record<string, string>;
  camelToPascalMap?: Record<string, string>;
  kebabToCamelMap?: Record<string, string>;
  kebabToPascalMap?: Record<string, string>;
  pascalToCamelMap?: Record<string, string>;
  pascalToKebabMap?: Record<string, string>;
}

function buildStaticPlaceholders(opts: {
  raw: Record<string, string> | undefined;
  caseMaps: CaseMaps;
}): Record<string, PlaceholderValue> {
  const { raw, caseMaps } = opts;
  if (!raw) {
    return {};
  }
  const result: Record<string, PlaceholderValue> = {};
  for (const [name, value] of Object.entries(raw)) {
    result[name] = new PlaceholderValue({ value, ...caseMaps });
  }
  return result;
}

export const TS_PREDICATES = new Set([
  "declareTypes",
  "declareConstants",
  "declareFunctions",
  "declareClasses",
  "declareInterfaces",
  "export",
  "exportValues",
  "exportTypes",
  "exportConstants",
  "exportFunctions",
  "exportClasses",
  "exportInterfaces",
  "import",
  "importValues",
  "importFrom",
  "importValuesFrom",
  "importTypesFrom",
  "importTypes",
  "importFromCurrentDir",
  "importFromParents",
  "importFromExternals",
  "importValuesFromCurrentDir",
  "importValuesFromParents",
  "importValuesFromExternals",
  "importTypesFromCurrentDir",
  "importTypesFromParents",
  "importTypesFromExternals",
  "useDeclarationOrder",
  "areBarrelFiles",
]);

function invertMap(
  map: Record<string, string> | undefined
): Record<string, string> | undefined {
  if (!map) {
    return;
  }
  const inverted: Record<string, string> = {};
  for (const [key, value] of Object.entries(map)) {
    inverted[value] = key;
  }
  return inverted;
}

function deriveCamelToPascalMap(opts: {
  kebabToPascalMap?: Record<string, string>;
  kebabToCamelMap?: Record<string, string>;
}): Record<string, string> | undefined {
  const { kebabToPascalMap, kebabToCamelMap } = opts;
  if (!(kebabToPascalMap || kebabToCamelMap)) {
    return;
  }

  const allKebabKeys = new Set([
    ...Object.keys(kebabToPascalMap ?? {}),
    ...Object.keys(kebabToCamelMap ?? {}),
  ]);

  const result: Record<string, string> = {};
  for (const kebabKey of allKebabKeys) {
    const camelValue = kebabToCamelMap?.[kebabKey] ?? toCamelCase(kebabKey);
    const pascalValue = kebabToPascalMap?.[kebabKey] ?? toPascalCase(kebabKey);
    result[camelValue] = pascalValue;
  }
  return result;
}

function buildContext(opts: {
  matched: MatchedPath;
  fileSystem: FileSystem;
}): PredicateContext {
  const { matched, fileSystem } = opts;
  const { path: matchedPath, placeholders } = matched;
  const basePath = fileSystem.isDirectory(matchedPath)
    ? matchedPath
    : dirname(matchedPath);

  return {
    path: matchedPath,
    placeholders,
    resolveTemplate(template: string): string {
      return resolveTemplate({ template, placeholders });
    },
    fileExists(relativePath: string): boolean {
      return fileSystem.fileExists(join(basePath, relativePath));
    },
    readDir(relativePath: string): string[] {
      return fileSystem.readDir(join(basePath, relativePath));
    },
  };
}

function normalizeMustBlocks(opts: {
  must?: MustPredicatesV1 | MustBlockV1[];
  mustNot?: MustPredicatesV1;
}): MustBlockV1[] {
  const { must, mustNot } = opts;
  if (Array.isArray(must)) {
    return mustNot ? [...must, { mustNot }] : must;
  }
  if (must && mustNot) {
    return [{ must, mustNot }];
  }
  if (must) {
    return [{ must }];
  }
  if (mustNot) {
    return [{ mustNot }];
  }
  return [];
}

function resolveBlockConventionName(opts: {
  block: MustBlockV1;
  conventionName: string;
}): string {
  return opts.block.name ?? opts.conventionName;
}

function isFileExcluded(opts: {
  filePath: string;
  excludeFiles: string[] | undefined;
  context: PredicateContext;
}): boolean {
  const { filePath, excludeFiles, context } = opts;
  if (!excludeFiles || excludeFiles.length === 0) {
    return false;
  }
  for (const pattern of excludeFiles) {
    const resolved = context.resolveTemplate(pattern);
    if (filePath === resolved || basename(filePath) === resolved) {
      return true;
    }
  }
  return false;
}

function evaluatePlaceholderSatisfies(opts: {
  raw: string;
  context: PredicateContext;
}): boolean {
  const { raw, context } = opts;
  const colonIndex = raw.indexOf(":");
  if (colonIndex < 1) {
    return false;
  }
  const name = raw.slice(0, colonIndex);
  const constraintRaw = raw.slice(colonIndex + 1);
  const placeholder = context.placeholders[name];
  if (!placeholder) {
    return false;
  }
  const constraint = parsePlaceholderConstraint(constraintRaw);
  if (!constraint) {
    return false;
  }
  return validatePlaceholderConstraint({
    value: placeholder.raw,
    constraint,
  });
}

function evaluateCondition(opts: {
  block: MustBlockV1;
  context: PredicateContext;
}): boolean {
  const { block, context } = opts;
  if (!block.if) {
    return true;
  }
  if (Object.hasOwn(block.if, "hasFile")) {
    const resolvedPath = context.resolveTemplate(block.if.hasFile);
    return context.fileExists(resolvedPath);
  }
  return evaluatePlaceholderSatisfies({
    raw: block.if.placeholderSatisfies,
    context,
  });
}

const TS_PREDICATE_HANDLERS: Record<
  string,
  (opts: {
    must: MustPredicatesV1;
    conventionName?: string;
    context: PredicateContext;
    fileStructure: FileStructure;
    severity?: DiagnosticSeverity;
  }) => Diagnostic[]
> = {
  declareTypes: ({ must, context, fileStructure, conventionName, severity }) =>
    must.declareTypes
      ? checkDeclareTypes({
          expected: must.declareTypes,
          context,
          fileStructure,
          conventionName,
          severity,
        })
      : [],
  declareConstants: ({
    must,
    context,
    fileStructure,
    conventionName,
    severity,
  }) =>
    must.declareConstants
      ? checkDeclareConstants({
          expected: must.declareConstants,
          context,
          fileStructure,
          conventionName,
          severity,
        })
      : [],
  declareFunctions: ({
    must,
    context,
    fileStructure,
    conventionName,
    severity,
  }) =>
    must.declareFunctions
      ? checkDeclareFunctions({
          expected: must.declareFunctions,
          context,
          fileStructure,
          conventionName,
          severity,
        })
      : [],
  declareClasses: ({
    must,
    context,
    fileStructure,
    conventionName,
    severity,
  }) =>
    must.declareClasses
      ? checkDeclareClasses({
          expected: must.declareClasses,
          context,
          fileStructure,
          conventionName,
          severity,
        })
      : [],
  declareInterfaces: ({
    must,
    context,
    fileStructure,
    conventionName,
    severity,
  }) =>
    must.declareInterfaces
      ? checkDeclareInterfaces({
          expected: must.declareInterfaces,
          context,
          fileStructure,
          conventionName,
          severity,
        })
      : [],
  exportValues: ({ must, context, fileStructure, conventionName, severity }) =>
    must.exportValues
      ? checkExportValues({
          expected: must.exportValues,
          predicateName: "exportValues",
          context,
          fileStructure,
          conventionName,
          severity,
        })
      : [],
  export: ({ must, context, fileStructure, conventionName, severity }) =>
    must.export
      ? checkExportValues({
          expected: must.export,
          predicateName: "export",
          context,
          fileStructure,
          conventionName,
          severity,
        })
      : [],
  exportTypes: ({ must, context, fileStructure, conventionName, severity }) =>
    must.exportTypes
      ? checkExportTypes({
          expected: must.exportTypes,
          context,
          fileStructure,
          conventionName,
          severity,
        })
      : [],
  exportConstants: ({
    must,
    context,
    fileStructure,
    conventionName,
    severity,
  }) =>
    must.exportConstants
      ? checkExportConstants({
          expected: must.exportConstants,
          context,
          fileStructure,
          conventionName,
          severity,
        })
      : [],
  exportFunctions: ({
    must,
    context,
    fileStructure,
    conventionName,
    severity,
  }) =>
    must.exportFunctions
      ? checkExportFunctions({
          expected: must.exportFunctions,
          context,
          fileStructure,
          conventionName,
          severity,
        })
      : [],
  exportClasses: ({
    must,
    context,
    fileStructure,
    conventionName,
    severity,
  }) =>
    must.exportClasses
      ? checkExportClasses({
          expected: must.exportClasses,
          context,
          fileStructure,
          conventionName,
          severity,
        })
      : [],
  exportInterfaces: ({
    must,
    context,
    fileStructure,
    conventionName,
    severity,
  }) =>
    must.exportInterfaces
      ? checkExportInterfaces({
          expected: must.exportInterfaces,
          context,
          fileStructure,
          conventionName,
          severity,
        })
      : [],
  importValues: ({ must, context, fileStructure, conventionName, severity }) =>
    must.importValues
      ? checkImportValues({
          expected: must.importValues,
          predicateName: "importValues",
          context,
          fileStructure,
          conventionName,
          severity,
        })
      : [],
  import: ({ must, context, fileStructure, conventionName, severity }) =>
    must.import
      ? checkImportValues({
          expected: must.import,
          predicateName: "import",
          context,
          fileStructure,
          conventionName,
          severity,
        })
      : [],
  importValuesFrom: ({
    must,
    context,
    fileStructure,
    conventionName,
    severity,
  }) =>
    must.importValuesFrom === undefined
      ? []
      : checkImportFrom({
          expected: must.importValuesFrom,
          importKind: "value",
          predicateName: "importValuesFrom",
          context,
          fileStructure,
          conventionName,
          severity,
        }),
  importTypesFrom: ({
    must,
    context,
    fileStructure,
    conventionName,
    severity,
  }) =>
    must.importTypesFrom === undefined
      ? []
      : checkImportFrom({
          expected: must.importTypesFrom,
          importKind: "type",
          predicateName: "importTypesFrom",
          context,
          fileStructure,
          conventionName,
          severity,
        }),
  importFrom: ({ must, context, fileStructure, conventionName, severity }) =>
    must.importFrom === undefined
      ? []
      : checkImportFrom({
          expected: must.importFrom,
          importKind: "either",
          predicateName: "importFrom",
          context,
          fileStructure,
          conventionName,
          severity,
        }),
  importTypes: ({ must, context, fileStructure, conventionName, severity }) =>
    must.importTypes
      ? checkImportTypes({
          expected: must.importTypes,
          context,
          fileStructure,
          conventionName,
          severity,
        })
      : [],
  importValuesFromCurrentDir: ({
    must,
    context,
    fileStructure,
    conventionName,
    severity,
  }) =>
    must.importValuesFromCurrentDir === undefined
      ? []
      : checkImportSource({
          expected: must.importValuesFromCurrentDir,
          predicateName: "importValuesFromCurrentDir",
          group: "currentDir",
          importKind: "value",
          context,
          fileStructure,
          conventionName,
          severity,
        }),
  importFromCurrentDir: ({
    must,
    context,
    fileStructure,
    conventionName,
    severity,
  }) =>
    must.importFromCurrentDir === undefined
      ? []
      : checkImportSource({
          expected: must.importFromCurrentDir,
          predicateName: "importFromCurrentDir",
          group: "currentDir",
          importKind: "value",
          context,
          fileStructure,
          conventionName,
          severity,
        }),
  importValuesFromParents: ({
    must,
    context,
    fileStructure,
    conventionName,
    severity,
  }) =>
    must.importValuesFromParents === undefined
      ? []
      : checkImportSource({
          expected: must.importValuesFromParents,
          predicateName: "importValuesFromParents",
          group: "parents",
          importKind: "value",
          context,
          fileStructure,
          conventionName,
          severity,
        }),
  importFromParents: ({
    must,
    context,
    fileStructure,
    conventionName,
    severity,
  }) =>
    must.importFromParents === undefined
      ? []
      : checkImportSource({
          expected: must.importFromParents,
          predicateName: "importFromParents",
          group: "parents",
          importKind: "value",
          context,
          fileStructure,
          conventionName,
          severity,
        }),
  importValuesFromExternals: ({
    must,
    context,
    fileStructure,
    conventionName,
    severity,
  }) =>
    must.importValuesFromExternals === undefined
      ? []
      : checkImportSource({
          expected: must.importValuesFromExternals,
          predicateName: "importValuesFromExternals",
          group: "externals",
          importKind: "value",
          context,
          fileStructure,
          conventionName,
          severity,
        }),
  importFromExternals: ({
    must,
    context,
    fileStructure,
    conventionName,
    severity,
  }) =>
    must.importFromExternals === undefined
      ? []
      : checkImportSource({
          expected: must.importFromExternals,
          predicateName: "importFromExternals",
          group: "externals",
          importKind: "value",
          context,
          fileStructure,
          conventionName,
          severity,
        }),
  importTypesFromCurrentDir: ({
    must,
    context,
    fileStructure,
    conventionName,
    severity,
  }) =>
    must.importTypesFromCurrentDir === undefined
      ? []
      : checkImportSource({
          expected: must.importTypesFromCurrentDir,
          predicateName: "importTypesFromCurrentDir",
          group: "currentDir",
          importKind: "type",
          context,
          fileStructure,
          conventionName,
          severity,
        }),
  importTypesFromParents: ({
    must,
    context,
    fileStructure,
    conventionName,
    severity,
  }) =>
    must.importTypesFromParents === undefined
      ? []
      : checkImportSource({
          expected: must.importTypesFromParents,
          predicateName: "importTypesFromParents",
          group: "parents",
          importKind: "type",
          context,
          fileStructure,
          conventionName,
          severity,
        }),
  importTypesFromExternals: ({
    must,
    context,
    fileStructure,
    conventionName,
    severity,
  }) =>
    must.importTypesFromExternals === undefined
      ? []
      : checkImportSource({
          expected: must.importTypesFromExternals,
          predicateName: "importTypesFromExternals",
          group: "externals",
          importKind: "type",
          context,
          fileStructure,
          conventionName,
          severity,
        }),
  useDeclarationOrder: ({
    must,
    context,
    fileStructure,
    conventionName,
    severity,
  }) =>
    must.useDeclarationOrder
      ? checkUseDeclarationOrder({
          expected: must.useDeclarationOrder,
          context,
          fileStructure,
          conventionName,
          severity,
        })
      : [],
  areBarrelFiles: ({
    must,
    context,
    fileStructure,
    conventionName,
    severity,
  }) =>
    must.areBarrelFiles
      ? checkAreBarrelFiles({
          expected: must.areBarrelFiles,
          context,
          fileStructure,
          conventionName,
          severity,
        })
      : [],
};

function checkTsPredicate(opts: {
  key: string;
  must: MustPredicatesV1;
  conventionName?: string;
  context: PredicateContext;
  fileStructure: FileStructure;
  severity?: DiagnosticSeverity;
}): Diagnostic[] {
  const handler = TS_PREDICATE_HANDLERS[opts.key];
  if (!handler) {
    return [];
  }
  return handler(opts);
}

function getOrParseFileStructure(opts: {
  filePath: string;
  fileSystem: FileSystem;
  cache: Map<string, FileStructure>;
}): FileStructure {
  const cached = opts.cache.get(opts.filePath);
  if (cached) {
    return cached;
  }

  const source = opts.fileSystem.readFile(opts.filePath);
  const structure = parseFileStructure({ source, filePath: opts.filePath });
  opts.cache.set(opts.filePath, structure);
  return structure;
}

const ITEM_LEVEL_MUST_NOT_PREDICATES = new Set<string>([
  "haveFiles",
  "declareTypes",
  "declareConstants",
  "declareFunctions",
  "declareInterfaces",
  "declareClasses",
  "exportValues",
  "export",
  "exportTypes",
  "exportConstants",
  "exportFunctions",
  "exportInterfaces",
  "exportClasses",
  "importValues",
  "import",
  "importValuesFrom",
  "importTypesFrom",
  "importFrom",
  "importTypes",
]);

function resolveEntryName(opts: {
  value: unknown;
  context: PredicateContext;
}): string {
  const { value, context } = opts;
  if (typeof value === "string") {
    return context.resolveTemplate(value);
  }
  if (
    value &&
    typeof value === "object" &&
    Object.hasOwn(value, "name") &&
    typeof (value as { name: unknown }).name === "string"
  ) {
    return context.resolveTemplate((value as { name: string }).name);
  }
  return "unknown";
}

function formatForbiddenMessage(opts: {
  key: string;
  value: unknown;
  context: PredicateContext;
}): string {
  const { key, value, context } = opts;
  const name = resolveEntryName({ value, context });

  switch (key) {
    case "haveType":
      return `Forbidden path type "${String(value)}"`;
    case "haveFiles":
      return `Forbidden file "${context.resolveTemplate(String(value))}"`;
    case "declareTypes":
      return `Forbidden type declaration "${name}"`;
    case "declareConstants":
      return `Forbidden constant declaration "${name}"`;
    case "declareFunctions":
      return `Forbidden function declaration "${name}"`;
    case "declareInterfaces":
      return `Forbidden interface declaration "${name}"`;
    case "declareClasses":
      return `Forbidden class declaration "${name}"`;
    case "exportValues":
    case "export":
      return `Forbidden export "${name}"`;
    case "exportTypes":
      return `Forbidden type export "${name}"`;
    case "exportConstants":
      return `Forbidden constant export "${name}"`;
    case "exportFunctions":
      return `Forbidden function export "${name}"`;
    case "exportInterfaces":
      return `Forbidden interface export "${name}"`;
    case "exportClasses":
      return `Forbidden class export "${name}"`;
    case "importValues":
    case "import":
      return `Forbidden import "${name}"`;
    case "importValuesFrom":
    case "importFrom":
      return `Forbidden import from "${context.resolveTemplate(String(value))}"`;
    case "importTypesFrom":
      return `Forbidden type import from "${context.resolveTemplate(String(value))}"`;
    case "importTypes":
      return `Forbidden type import "${name}"`;
    case "importValuesFromCurrentDir":
    case "importFromCurrentDir":
      return value === false
        ? "Missing import from current directory is not allowed"
        : "Forbidden import from current directory";
    case "importValuesFromParents":
    case "importFromParents":
      return value === false
        ? "Missing import from parent directories is not allowed"
        : "Forbidden import from parent directories";
    case "importValuesFromExternals":
    case "importFromExternals":
      return value === false
        ? "Missing import from external packages is not allowed"
        : "Forbidden import from external packages";
    case "importTypesFromCurrentDir":
      return value === false
        ? "Missing type import from current directory is not allowed"
        : "Forbidden type import from current directory";
    case "importTypesFromParents":
      return value === false
        ? "Missing type import from parent directories is not allowed"
        : "Forbidden type import from parent directories";
    case "importTypesFromExternals":
      return value === false
        ? "Missing type import from external packages is not allowed"
        : "Forbidden type import from external packages";
    case "useDeclarationOrder":
      return `Forbidden declaration order "${(value as string[])
        .map((entry) => context.resolveTemplate(entry))
        .join('", "')}"`;
    case "areBarrelFiles":
      return value === false
        ? "Forbidden non-barrel file"
        : "Forbidden barrel file";
    default:
      return `Forbidden ${key}`;
  }
}

function buildSingletonPredicate(opts: {
  key: string;
  value: unknown;
}): MustPredicatesV1 {
  return { [opts.key]: opts.value } as MustPredicatesV1;
}

function buildMustNotChecks(opts: {
  mustNot: MustPredicatesV1;
}): Array<{ key: string; predicate: MustPredicatesV1; value: unknown }> {
  const checks: Array<{
    key: string;
    predicate: MustPredicatesV1;
    value: unknown;
  }> = [];

  for (const key of Object.keys(opts.mustNot)) {
    const value = opts.mustNot[key as keyof MustPredicatesV1];
    if (value === undefined) {
      continue;
    }
    if (Array.isArray(value) && ITEM_LEVEL_MUST_NOT_PREDICATES.has(key)) {
      for (const item of value) {
        checks.push({
          key,
          predicate: buildSingletonPredicate({ key, value: [item] }),
          value: item,
        });
      }
      continue;
    }
    checks.push({
      key,
      predicate: buildSingletonPredicate({ key, value }),
      value,
    });
  }

  return checks;
}

function checkMustPredicates(opts: {
  must: MustPredicatesV1;
  conventionName?: string;
  context: PredicateContext;
  fileSystem: FileSystem;
  fileStructureCache: Map<string, FileStructure>;
  severity?: DiagnosticSeverity;
}): Diagnostic[] {
  const {
    must,
    conventionName,
    context,
    fileSystem,
    fileStructureCache,
    severity,
  } = opts;
  const diagnostics: Diagnostic[] = [];
  const keys = Object.keys(must);

  let fileStructure: FileStructure | undefined;

  const needsTs = keys.some((k) => TS_PREDICATES.has(k));
  if (needsTs) {
    fileStructure = getOrParseFileStructure({
      filePath: context.path,
      fileSystem,
      cache: fileStructureCache,
    });
  }

  for (const key of keys) {
    if (key === "haveType" && must.haveType) {
      diagnostics.push(
        ...checkHaveType({
          expected: must.haveType,
          context,
          fileSystem,
          conventionName,
          severity,
        })
      );
    }
    if (key === "haveFiles" && must.haveFiles) {
      diagnostics.push(
        ...checkHaveFiles({
          expected: must.haveFiles,
          context,
          conventionName,
          severity,
        })
      );
    }
    if (fileStructure && TS_PREDICATES.has(key)) {
      diagnostics.push(
        ...checkTsPredicate({
          key,
          must,
          conventionName,
          context,
          fileStructure,
          severity,
        })
      );
    }
  }

  return diagnostics;
}

function checkMustNotPredicates(opts: {
  mustNot: MustPredicatesV1;
  conventionName?: string;
  context: PredicateContext;
  fileSystem: FileSystem;
  fileStructureCache: Map<string, FileStructure>;
  severity?: DiagnosticSeverity;
}): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];
  const checks = buildMustNotChecks({ mustNot: opts.mustNot });

  for (const check of checks) {
    const normalDiagnostics = checkMustPredicates({
      must: check.predicate,
      conventionName: opts.conventionName,
      context: opts.context,
      fileSystem: opts.fileSystem,
      fileStructureCache: opts.fileStructureCache,
      severity: opts.severity,
    });
    if (normalDiagnostics.length > 0) {
      continue;
    }
    diagnostics.push(
      createDiagnostic({
        filePath: opts.context.path,
        predicateName: `mustNot.${check.key}`,
        message: formatForbiddenMessage({
          key: check.key,
          value: check.value,
          context: opts.context,
        }),
        conventionName: opts.conventionName,
        severity: opts.severity,
      })
    );
  }

  return diagnostics;
}

function checkPredicates(opts: {
  must?: MustPredicatesV1;
  mustNot?: MustPredicatesV1;
  conventionName?: string;
  context: PredicateContext;
  fileSystem: FileSystem;
  fileStructureCache: Map<string, FileStructure>;
  severity?: DiagnosticSeverity;
}): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];
  if (opts.must) {
    diagnostics.push(
      ...checkMustPredicates({
        must: opts.must,
        conventionName: opts.conventionName,
        context: opts.context,
        fileSystem: opts.fileSystem,
        fileStructureCache: opts.fileStructureCache,
        severity: opts.severity,
      })
    );
  }
  if (opts.mustNot) {
    diagnostics.push(
      ...checkMustNotPredicates({
        mustNot: opts.mustNot,
        conventionName: opts.conventionName,
        context: opts.context,
        fileSystem: opts.fileSystem,
        fileStructureCache: opts.fileStructureCache,
        severity: opts.severity,
      })
    );
  }
  return diagnostics;
}

async function evaluateForBlock(opts: {
  block: MustBlockV1;
  parentContext: PredicateContext;
  fileSystem: FileSystem;
  conventionName?: string;
  fileStructureCache: Map<string, FileStructure>;
  severity?: DiagnosticSeverity;
  checkedPaths: Set<string>;
  kebabToPascalMap?: Record<string, string>;
  kebabToCamelMap?: Record<string, string>;
  pascalToKebabMap?: Record<string, string>;
  camelToKebabMap?: Record<string, string>;
  camelToPascalMap?: Record<string, string>;
  pascalToCamelMap?: Record<string, string>;
}): Promise<Diagnostic[]> {
  const {
    block,
    parentContext,
    fileSystem,
    conventionName,
    fileStructureCache,
    severity,
    checkedPaths,
    kebabToPascalMap,
    kebabToCamelMap,
    pascalToKebabMap,
    camelToKebabMap,
    camelToPascalMap,
    pascalToCamelMap,
  } = opts;

  if (!block.for) {
    if (
      isFileExcluded({
        filePath: parentContext.path,
        excludeFiles: block.excludeFiles,
        context: parentContext,
      })
    ) {
      return [];
    }
    return checkPredicates({
      must: block.must,
      mustNot: block.mustNot,
      conventionName,
      context: parentContext,
      fileSystem,
      fileStructureCache,
      severity,
    });
  }

  const filesPatterns = Array.isArray(block.for.files)
    ? block.for.files
    : [block.for.files];

  const basePath = fileSystem.isDirectory(parentContext.path)
    ? parentContext.path
    : dirname(parentContext.path);

  const fullPatterns = filesPatterns.map((f) =>
    posix.join(basePath, parentContext.resolveTemplate(f))
  );
  const matched = await matchPaths({
    patterns: fullPatterns,
    fileSystem,
    kebabToPascalMap,
    kebabToCamelMap,
    pascalToKebabMap,
    camelToKebabMap,
    camelToPascalMap,
    pascalToCamelMap,
  });

  if (matched.length === 0) {
    return [];
  }

  const diagnostics: Diagnostic[] = [];
  for (const entry of matched) {
    checkedPaths.add(entry.path);
    const mergedPlaceholders = { ...entry.placeholders };
    for (const [key, value] of Object.entries(parentContext.placeholders)) {
      mergedPlaceholders[key] = value;
    }

    const forContext = buildContext({
      matched: {
        path: entry.path,
        placeholders: mergedPlaceholders,
      },
      fileSystem,
    });

    if (
      isFileExcluded({
        filePath: entry.path,
        excludeFiles: block.excludeFiles,
        context: forContext,
      })
    ) {
      continue;
    }

    diagnostics.push(
      ...checkPredicates({
        must: block.must,
        mustNot: block.mustNot,
        conventionName,
        context: forContext,
        fileSystem,
        fileStructureCache,
        severity,
      })
    );
  }

  return diagnostics;
}

export interface RunResult {
  diagnostics: Diagnostic[];
  elapsed: number;
  filesChecked: number;
}

export async function run(opts: {
  config: ConfigV1;
  fileSystem: FileSystem;
}): Promise<RunResult> {
  const startTime = performance.now();
  const { config, fileSystem } = opts;
  const fileStructureCache = new Map<string, FileStructure>();

  const { kebabToPascalMap, kebabToCamelMap } = config;
  const pascalToKebabMap = invertMap(kebabToPascalMap);
  const camelToKebabMap = invertMap(kebabToCamelMap);
  const camelToPascalMap = deriveCamelToPascalMap({
    kebabToPascalMap,
    kebabToCamelMap,
  });
  const pascalToCamelMap = invertMap(camelToPascalMap);

  const matchResults = await Promise.all(
    config.conventions.map((convention) => {
      const patterns = Array.isArray(convention.paths)
        ? convention.paths
        : [convention.paths];
      return matchPaths({
        patterns,
        fileSystem,
        kebabToPascalMap,
        kebabToCamelMap,
        pascalToKebabMap,
        camelToKebabMap,
        camelToPascalMap,
        pascalToCamelMap,
      });
    })
  );

  const checkedPaths = new Set<string>();
  const diagnostics: Diagnostic[] = [];

  const caseMaps: CaseMaps = {
    kebabToPascalMap,
    kebabToCamelMap,
    pascalToKebabMap,
    camelToKebabMap,
    camelToPascalMap,
    pascalToCamelMap,
  };

  for (let i = 0; i < config.conventions.length; i++) {
    const convention = config.conventions[i];
    const matched = matchResults[i];
    const blocks = normalizeMustBlocks({
      must: convention.must,
      mustNot: convention.mustNot,
    });
    const conventionName =
      convention.name ??
      generateConventionName({
        must: convention.must,
        mustNot: convention.mustNot,
      });
    const severity: DiagnosticSeverity = convention.severity ?? "error";
    const staticPlaceholders = buildStaticPlaceholders({
      raw: convention.placeholders,
      caseMaps,
    });

    for (const entry of matched) {
      checkedPaths.add(entry.path);
      const mergedEntry: MatchedPath = {
        path: entry.path,
        placeholders: { ...staticPlaceholders, ...entry.placeholders },
      };
      const context = buildContext({ matched: mergedEntry, fileSystem });

      if (
        isFileExcluded({
          filePath: entry.path,
          excludeFiles: convention.excludeFiles,
          context,
        })
      ) {
        continue;
      }

      for (const block of blocks) {
        if (!evaluateCondition({ block, context })) {
          continue;
        }
        diagnostics.push(
          ...(await evaluateForBlock({
            block,
            parentContext: context,
            fileSystem,
            conventionName: resolveBlockConventionName({
              block,
              conventionName,
            }),
            fileStructureCache,
            severity,
            checkedPaths,
            kebabToPascalMap,
            kebabToCamelMap,
            pascalToKebabMap,
            camelToKebabMap,
            camelToPascalMap,
            pascalToCamelMap,
          }))
        );
      }
    }
  }

  return {
    diagnostics,
    filesChecked: checkedPaths.size,
    elapsed: performance.now() - startTime,
  };
}
