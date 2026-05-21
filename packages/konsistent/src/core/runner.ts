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
import { checkExport } from "../typescript/predicates/export.js";
import { checkExportClasses } from "../typescript/predicates/export-classes.js";
import { checkExportConstants } from "../typescript/predicates/export-constants.js";
import { checkExportFunctions } from "../typescript/predicates/export-functions.js";
import { checkExportInterfaces } from "../typescript/predicates/export-interfaces.js";
import { checkExportTypes } from "../typescript/predicates/export-types.js";
import { checkImport } from "../typescript/predicates/import.js";
import { checkImportTypes } from "../typescript/predicates/import-types.js";
import type { FileStructure } from "../typescript/types.js";
import { toCamelCase, toPascalCase } from "./case-utils.js";
import type { PredicateContext } from "./context.js";
import { generateConventionName } from "./convention-name.js";
import type { Diagnostic, DiagnosticSeverity } from "./diagnostics.js";
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
  "export",
  "exportTypes",
  "exportConstants",
  "exportFunctions",
  "exportClasses",
  "exportInterfaces",
  "import",
  "importTypes",
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

function normalizeMustBlocks(
  must: MustPredicatesV1 | MustBlockV1[]
): MustBlockV1[] {
  if (Array.isArray(must)) {
    return must;
  }
  return [{ must }];
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
  export: ({ must, context, fileStructure, conventionName, severity }) =>
    must.export
      ? checkExport({
          expected: must.export,
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
  import: ({ must, context, fileStructure, conventionName, severity }) =>
    must.import
      ? checkImport({
          expected: must.import,
          context,
          fileStructure,
          conventionName,
          severity,
        })
      : [],
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

function checkPredicates(opts: {
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
    const blocks = normalizeMustBlocks(convention.must);
    const conventionName =
      convention.name ?? generateConventionName({ must: convention.must });
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
