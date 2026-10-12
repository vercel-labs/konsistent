import { basename, dirname, posix } from "node:path";
import {
  compileImportSourceConstraints,
  importSourceConstraintValue,
} from "@konsistent/convention";
import type {
  ConfigV1,
  IfConditionV1,
  ImportDefinitionV1,
  MustBlockV1,
  MustPredicatesV1,
} from "../config/schema.js";
import { checkHaveDirectories } from "../predicates/have-directories.js";
import { checkHaveFiles } from "../predicates/have-files.js";
import { checkHaveType } from "../predicates/have-type.js";
import { hasImport, hasImportFrom } from "../typescript/import-matcher.js";
import type { TypeScriptSession } from "../typescript/native-session.js";
import { createTypeScriptSession } from "../typescript/native-session.js";
import { parseFileStructure } from "../typescript/parser.js";
import { checkAreBarrelFiles } from "../typescript/predicates/are-barrel-files.js";
import { checkCallFunction } from "../typescript/predicates/call-function.js";
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
import { checkImportSource } from "../typescript/predicates/import-source.js";
import { checkImportSourceExact } from "../typescript/predicates/import-source-exact.js";
import { checkImportTypes } from "../typescript/predicates/import-types.js";
import { checkImportValues } from "../typescript/predicates/import-values.js";
import {
  checkModuleSource,
  checkModuleSourceGroup,
} from "../typescript/predicates/module-source.js";
import { checkUseDeclarationOrder } from "../typescript/predicates/use-declaration-order.js";
import type { FileStructure } from "../typescript/types.js";
import { toCamelCase, toPascalCase } from "./case-utils.js";
import type { PredicateContext } from "./context.js";
import { generateConventionName } from "./convention-name.js";
import type { Diagnostic, DiagnosticSeverity } from "./diagnostics.js";
import { createDiagnostic } from "./diagnostics.js";
import type { FileSystem } from "./filesystem.js";
import type { MatchedPath } from "./path-matcher.js";
import { matchesPathPattern, matchPaths } from "./path-matcher.js";
import type { PathSelection } from "./path-selection.js";
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
  "callFunction",
  "declareClasses",
  "declareInterfaces",
  "export",
  "exportValues",
  "exportTypes",
  "exportValuesFrom",
  "exportTypesFrom",
  "exportValuesFromCurrentDir",
  "exportValuesFromParents",
  "exportValuesFromExternals",
  "exportTypesFromCurrentDir",
  "exportTypesFromParents",
  "exportTypesFromExternals",
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
  typescriptSession?: TypeScriptSession;
}): PredicateContext {
  const { matched, fileSystem } = opts;
  const { path: matchedPath, placeholders } = matched;
  const basePath = fileSystem.isDirectory(matchedPath)
    ? matchedPath
    : dirname(matchedPath);

  return {
    directoryExists(relativePath: string): boolean {
      return fileSystem.directoryExists(posix.join(basePath, relativePath));
    },
    fileExists(relativePath: string): boolean {
      return fileSystem.fileExists(posix.join(basePath, relativePath));
    },
    path: matchedPath,
    placeholders,
    readDir(relativePath: string): string[] {
      return fileSystem.readDir(posix.join(basePath, relativePath));
    },
    resolveTemplate(template: string): string {
      return resolveTemplate({ placeholders, template });
    },
    typescriptSession: opts.typescriptSession,
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
    if (matchesPathPattern({ filePath, pattern: resolved })) {
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
    constraint,
    value: placeholder.raw,
  });
}

function evaluateCondition(opts: {
  condition: IfConditionV1;
  context: PredicateContext;
  fileSystem: FileSystem;
  fileStructureCache: Map<string, FileStructure>;
}): boolean {
  const { condition, context, fileSystem, fileStructureCache } = opts;
  if (Object.hasOwn(condition, "hasFile")) {
    const resolvedPath = context.resolveTemplate(
      (condition as { hasFile: string }).hasFile
    );
    return context.fileExists(resolvedPath);
  }
  if (Object.hasOwn(condition, "hasDirectory")) {
    const resolvedPath = context.resolveTemplate(
      (condition as { hasDirectory: string }).hasDirectory
    );
    return context.directoryExists(resolvedPath);
  }
  if (Object.hasOwn(condition, "placeholderSatisfies")) {
    return evaluatePlaceholderSatisfies({
      context,
      raw: (condition as { placeholderSatisfies: string }).placeholderSatisfies,
    });
  }
  if (!fileSystem.isFile(context.path)) {
    return false;
  }

  const fileStructure = getOrParseFileStructure({
    cache: fileStructureCache,
    filePath: context.path,
    fileSystem,
    session: context.typescriptSession,
  });

  if (Object.hasOwn(condition, "hasValueImport")) {
    return hasImport({
      context,
      expected: (condition as { hasValueImport: string | ImportDefinitionV1 })
        .hasValueImport,
      fileStructure,
      importKind: "value",
    });
  }
  if (Object.hasOwn(condition, "hasTypeImport")) {
    return hasImport({
      context,
      expected: (condition as { hasTypeImport: string | ImportDefinitionV1 })
        .hasTypeImport,
      fileStructure,
      importKind: "type",
    });
  }
  if (Object.hasOwn(condition, "hasValueImportFrom")) {
    return hasImportFrom({
      context,
      expected: (condition as { hasValueImportFrom: string })
        .hasValueImportFrom,
      fileStructure,
      importKind: "value",
    });
  }
  return hasImportFrom({
    context,
    expected: (condition as { hasTypeImportFrom: string }).hasTypeImportFrom,
    fileStructure,
    importKind: "type",
  });
}

function evaluateConditions(opts: {
  ifCondition?: IfConditionV1;
  ifNotCondition?: IfConditionV1;
  context: PredicateContext;
  fileSystem: FileSystem;
  fileStructureCache: Map<string, FileStructure>;
}): boolean {
  const {
    ifCondition,
    ifNotCondition,
    context,
    fileSystem,
    fileStructureCache,
  } = opts;
  if (
    ifCondition &&
    !evaluateCondition({
      condition: ifCondition,
      context,
      fileStructureCache,
      fileSystem,
    })
  ) {
    return false;
  }
  if (
    ifNotCondition &&
    evaluateCondition({
      condition: ifNotCondition,
      context,
      fileStructureCache,
      fileSystem,
    })
  ) {
    return false;
  }
  return true;
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
  areBarrelFiles: ({
    must,
    context,
    fileStructure,
    conventionName,
    severity,
  }) =>
    must.areBarrelFiles
      ? checkAreBarrelFiles({
          context,
          conventionName,
          expected: must.areBarrelFiles,
          fileStructure,
          severity,
        })
      : [],
  callFunction: ({ must, context, fileStructure, conventionName, severity }) =>
    must.callFunction
      ? checkCallFunction({
          context,
          conventionName,
          expected: must.callFunction,
          fileStructure,
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
          context,
          conventionName,
          expected: must.declareClasses,
          fileStructure,
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
          context,
          conventionName,
          expected: must.declareConstants,
          fileStructure,
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
          context,
          conventionName,
          expected: must.declareFunctions,
          fileStructure,
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
          context,
          conventionName,
          expected: must.declareInterfaces,
          fileStructure,
          severity,
        })
      : [],
  declareTypes: ({ must, context, fileStructure, conventionName, severity }) =>
    must.declareTypes
      ? checkDeclareTypes({
          context,
          conventionName,
          expected: must.declareTypes,
          fileStructure,
          severity,
        })
      : [],
  export: ({ must, context, fileStructure, conventionName, severity }) =>
    must.export
      ? checkExportValues({
          context,
          conventionName,
          expected: must.export,
          fileStructure,
          predicateName: "export",
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
          context,
          conventionName,
          expected: must.exportClasses,
          fileStructure,
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
          context,
          conventionName,
          expected: must.exportConstants,
          fileStructure,
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
          context,
          conventionName,
          expected: must.exportFunctions,
          fileStructure,
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
          context,
          conventionName,
          expected: must.exportInterfaces,
          fileStructure,
          severity,
        })
      : [],
  exportTypes: ({ must, context, fileStructure, conventionName, severity }) =>
    must.exportTypes
      ? checkExportTypes({
          context,
          conventionName,
          expected: must.exportTypes,
          fileStructure,
          severity,
        })
      : [],
  exportTypesFrom: ({
    must,
    context,
    fileStructure,
    conventionName,
    severity,
  }) =>
    must.exportTypesFrom === undefined
      ? []
      : checkModuleSource({
          context,
          conventionName,
          direction: "export",
          expected: must.exportTypesFrom,
          fileStructure,
          kind: "type",
          predicateName: "exportTypesFrom",
          severity,
        }),
  exportTypesFromCurrentDir: ({
    must,
    context,
    fileStructure,
    conventionName,
    severity,
  }) =>
    must.exportTypesFromCurrentDir === undefined
      ? []
      : checkModuleSourceGroup({
          context,
          conventionName,
          direction: "export",
          expected: must.exportTypesFromCurrentDir,
          fileStructure,
          group: "currentDir",
          kind: "type",
          predicateName: "exportTypesFromCurrentDir",
          severity,
        }),
  exportTypesFromExternals: ({
    must,
    context,
    fileStructure,
    conventionName,
    severity,
  }) =>
    must.exportTypesFromExternals === undefined
      ? []
      : checkModuleSourceGroup({
          context,
          conventionName,
          direction: "export",
          expected: must.exportTypesFromExternals,
          fileStructure,
          group: "externals",
          kind: "type",
          predicateName: "exportTypesFromExternals",
          severity,
        }),
  exportTypesFromParents: ({
    must,
    context,
    fileStructure,
    conventionName,
    severity,
  }) =>
    must.exportTypesFromParents === undefined
      ? []
      : checkModuleSourceGroup({
          context,
          conventionName,
          direction: "export",
          expected: must.exportTypesFromParents,
          fileStructure,
          group: "parents",
          kind: "type",
          predicateName: "exportTypesFromParents",
          severity,
        }),
  exportValues: ({ must, context, fileStructure, conventionName, severity }) =>
    must.exportValues
      ? checkExportValues({
          context,
          conventionName,
          expected: must.exportValues,
          fileStructure,
          predicateName: "exportValues",
          severity,
        })
      : [],
  exportValuesFrom: ({
    must,
    context,
    fileStructure,
    conventionName,
    severity,
  }) =>
    must.exportValuesFrom === undefined
      ? []
      : checkModuleSource({
          context,
          conventionName,
          direction: "export",
          expected: must.exportValuesFrom,
          fileStructure,
          kind: "value",
          predicateName: "exportValuesFrom",
          severity,
        }),
  exportValuesFromCurrentDir: ({
    must,
    context,
    fileStructure,
    conventionName,
    severity,
  }) =>
    must.exportValuesFromCurrentDir === undefined
      ? []
      : checkModuleSourceGroup({
          context,
          conventionName,
          direction: "export",
          expected: must.exportValuesFromCurrentDir,
          fileStructure,
          group: "currentDir",
          kind: "value",
          predicateName: "exportValuesFromCurrentDir",
          severity,
        }),
  exportValuesFromExternals: ({
    must,
    context,
    fileStructure,
    conventionName,
    severity,
  }) =>
    must.exportValuesFromExternals === undefined
      ? []
      : checkModuleSourceGroup({
          context,
          conventionName,
          direction: "export",
          expected: must.exportValuesFromExternals,
          fileStructure,
          group: "externals",
          kind: "value",
          predicateName: "exportValuesFromExternals",
          severity,
        }),
  exportValuesFromParents: ({
    must,
    context,
    fileStructure,
    conventionName,
    severity,
  }) =>
    must.exportValuesFromParents === undefined
      ? []
      : checkModuleSourceGroup({
          context,
          conventionName,
          direction: "export",
          expected: must.exportValuesFromParents,
          fileStructure,
          group: "parents",
          kind: "value",
          predicateName: "exportValuesFromParents",
          severity,
        }),
  import: ({ must, context, fileStructure, conventionName, severity }) =>
    must.import
      ? checkImportValues({
          context,
          conventionName,
          expected: must.import,
          fileStructure,
          predicateName: "import",
          severity,
        })
      : [],
  importFrom: ({ must, context, fileStructure, conventionName, severity }) =>
    must.importFrom === undefined
      ? []
      : checkImportSourceExact({
          context,
          conventionName,
          expected: must.importFrom,
          fileStructure,
          importKind: "either",
          predicateName: "importFrom",
          selectorSyntax: false,
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
          context,
          conventionName,
          expected: must.importFromCurrentDir,
          fileStructure,
          group: "currentDir",
          importKind: "value",
          predicateName: "importFromCurrentDir",
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
          context,
          conventionName,
          expected: must.importFromExternals,
          fileStructure,
          group: "externals",
          importKind: "value",
          predicateName: "importFromExternals",
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
          context,
          conventionName,
          expected: must.importFromParents,
          fileStructure,
          group: "parents",
          importKind: "value",
          predicateName: "importFromParents",
          severity,
        }),
  importTypes: ({ must, context, fileStructure, conventionName, severity }) =>
    must.importTypes
      ? checkImportTypes({
          context,
          conventionName,
          expected: must.importTypes,
          fileStructure,
          severity,
        })
      : [],
  importTypesFrom: ({
    must,
    context,
    fileStructure,
    conventionName,
    severity,
  }) =>
    must.importTypesFrom === undefined
      ? []
      : checkImportSourceExact({
          context,
          conventionName,
          expected: must.importTypesFrom,
          fileStructure,
          importKind: "type",
          predicateName: "importTypesFrom",
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
          context,
          conventionName,
          expected: must.importTypesFromCurrentDir,
          fileStructure,
          group: "currentDir",
          importKind: "type",
          predicateName: "importTypesFromCurrentDir",
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
          context,
          conventionName,
          expected: must.importTypesFromExternals,
          fileStructure,
          group: "externals",
          importKind: "type",
          predicateName: "importTypesFromExternals",
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
          context,
          conventionName,
          expected: must.importTypesFromParents,
          fileStructure,
          group: "parents",
          importKind: "type",
          predicateName: "importTypesFromParents",
          severity,
        }),
  importValues: ({ must, context, fileStructure, conventionName, severity }) =>
    must.importValues
      ? checkImportValues({
          context,
          conventionName,
          expected: must.importValues,
          fileStructure,
          predicateName: "importValues",
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
      : checkImportSourceExact({
          context,
          conventionName,
          expected: must.importValuesFrom,
          fileStructure,
          importKind: "value",
          predicateName: "importValuesFrom",
          severity,
        }),
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
          context,
          conventionName,
          expected: must.importValuesFromCurrentDir,
          fileStructure,
          group: "currentDir",
          importKind: "value",
          predicateName: "importValuesFromCurrentDir",
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
          context,
          conventionName,
          expected: must.importValuesFromExternals,
          fileStructure,
          group: "externals",
          importKind: "value",
          predicateName: "importValuesFromExternals",
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
          context,
          conventionName,
          expected: must.importValuesFromParents,
          fileStructure,
          group: "parents",
          importKind: "value",
          predicateName: "importValuesFromParents",
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
          context,
          conventionName,
          expected: must.useDeclarationOrder,
          fileStructure,
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
  session?: TypeScriptSession;
}): FileStructure {
  const cached = opts.cache.get(opts.filePath);
  if (cached) {
    return cached;
  }

  const source = opts.fileSystem.readFile(opts.filePath);
  const structure = parseFileStructure({
    filePath: opts.filePath,
    session: opts.session,
    source,
  });
  opts.cache.set(opts.filePath, structure);
  return structure;
}

const ITEM_LEVEL_MUST_NOT_PREDICATES = new Set<string>([
  "haveFiles",
  "haveDirectories",
  "declareTypes",
  "declareConstants",
  "declareFunctions",
  "callFunction",
  "declareInterfaces",
  "declareClasses",
  "exportValues",
  "export",
  "exportTypes",
  "exportValuesFrom",
  "exportTypesFrom",
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

const SOURCE_SELECTOR_PREDICATES = new Set([
  "importValuesFrom",
  "importTypesFrom",
  "exportValuesFrom",
  "exportTypesFrom",
]);

function formatForbiddenExportSourceGroup(opts: {
  key: string;
  value: unknown;
}): string {
  const noun = opts.key.startsWith("exportTypes") ? "type export" : "export";
  let location = "external packages";
  if (opts.key.endsWith("CurrentDir")) {
    location = "current directory";
  } else if (opts.key.endsWith("Parents")) {
    location = "parent directories";
  }
  return opts.value === false
    ? `Missing ${noun} from ${location} is not allowed`
    : `Forbidden ${noun} from ${location}`;
}

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

function resolveEntryAlias(opts: {
  value: unknown;
  context: PredicateContext;
}): string | undefined {
  const { value, context } = opts;
  if (
    value &&
    typeof value === "object" &&
    Object.hasOwn(value, "alias") &&
    typeof (value as { alias: unknown }).alias === "string"
  ) {
    return context.resolveTemplate((value as { alias: string }).alias);
  }
}

function formatForbiddenMessage(opts: {
  key: string;
  value: unknown;
  context: PredicateContext;
}): string {
  const { key, value, context } = opts;
  const name = resolveEntryName({ context, value });
  const alias = resolveEntryAlias({ context, value });
  const aliasSuffix = alias === undefined ? "" : ` as "${alias}"`;

  switch (key) {
    case "haveType":
      return `Forbidden path type "${String(value)}"`;
    case "haveFiles":
      return `Forbidden file "${context.resolveTemplate(String(value))}"`;
    case "haveDirectories":
      return `Forbidden directory "${context.resolveTemplate(String(value))}"`;
    case "declareTypes":
      return `Forbidden type declaration "${name}"`;
    case "declareConstants":
      return `Forbidden constant declaration "${name}"`;
    case "declareFunctions":
      return `Forbidden function declaration "${name}"`;
    case "callFunction":
      return `Forbidden call to function "${name}"`;
    case "declareInterfaces":
      return `Forbidden interface declaration "${name}"`;
    case "declareClasses":
      return `Forbidden class declaration "${name}"`;
    case "exportValues":
    case "export":
      return `Forbidden export "${name}"${aliasSuffix}`;
    case "exportTypes":
      return `Forbidden type export "${name}"${aliasSuffix}`;
    case "exportValuesFrom":
      return `Forbidden export from "${context.resolveTemplate(String(value))}"`;
    case "exportTypesFrom":
      return `Forbidden type export from "${context.resolveTemplate(String(value))}"`;
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
      return `Forbidden import "${name}"${aliasSuffix}`;
    case "importValuesFrom":
    case "importFrom":
      return `Forbidden import from "${context.resolveTemplate(String(value))}"`;
    case "importTypesFrom":
      return `Forbidden type import from "${context.resolveTemplate(String(value))}"`;
    case "importTypes":
      return `Forbidden type import "${name}"${aliasSuffix}`;
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
    case "exportValuesFromCurrentDir":
    case "exportValuesFromParents":
    case "exportValuesFromExternals":
    case "exportTypesFromCurrentDir":
    case "exportTypesFromParents":
    case "exportTypesFromExternals":
      return formatForbiddenExportSourceGroup({ key, value });
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

function validatedSourceConstraints(opts: { key: string; value: string[] }) {
  const compiled = compileImportSourceConstraints({
    expected: opts.value,
    sourceLabel: opts.key.startsWith("export") ? "Export" : "Import",
  });
  if (!compiled.success) {
    throw new Error(compiled.error);
  }
  return compiled.constraints;
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
    if (Array.isArray(value) && SOURCE_SELECTOR_PREDICATES.has(key)) {
      for (const constraint of validatedSourceConstraints({
        key,
        value: value as string[],
      })) {
        checks.push({
          key,
          predicate: buildSingletonPredicate({
            key,
            value: importSourceConstraintValue({ constraint }),
          }),
          value: constraint.source,
        });
      }
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
      cache: fileStructureCache,
      filePath: context.path,
      fileSystem,
      session: context.typescriptSession,
    });
  }

  for (const key of keys) {
    if (key === "haveType" && must.haveType) {
      diagnostics.push(
        ...checkHaveType({
          context,
          conventionName,
          expected: must.haveType,
          fileSystem,
          severity,
        })
      );
    }
    if (key === "haveFiles" && must.haveFiles) {
      diagnostics.push(
        ...checkHaveFiles({
          context,
          conventionName,
          expected: must.haveFiles,
          severity,
        })
      );
    }
    if (key === "haveDirectories" && must.haveDirectories) {
      diagnostics.push(
        ...checkHaveDirectories({
          context,
          conventionName,
          expected: must.haveDirectories,
          severity,
        })
      );
    }
    if (fileStructure && TS_PREDICATES.has(key)) {
      diagnostics.push(
        ...checkTsPredicate({
          context,
          conventionName,
          fileStructure,
          key,
          must,
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
      context: opts.context,
      conventionName: opts.conventionName,
      fileStructureCache: opts.fileStructureCache,
      fileSystem: opts.fileSystem,
      must: check.predicate,
      severity: opts.severity,
    });
    if (normalDiagnostics.length > 0) {
      continue;
    }
    diagnostics.push(
      createDiagnostic({
        conventionName: opts.conventionName,
        filePath: opts.context.path,
        message: formatForbiddenMessage({
          context: opts.context,
          key: check.key,
          value: check.value,
        }),
        predicateName: `mustNot.${check.key}`,
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
        context: opts.context,
        conventionName: opts.conventionName,
        fileStructureCache: opts.fileStructureCache,
        fileSystem: opts.fileSystem,
        must: opts.must,
        severity: opts.severity,
      })
    );
  }
  if (opts.mustNot) {
    diagnostics.push(
      ...checkMustNotPredicates({
        context: opts.context,
        conventionName: opts.conventionName,
        fileStructureCache: opts.fileStructureCache,
        fileSystem: opts.fileSystem,
        mustNot: opts.mustNot,
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
  pathSelection?: PathSelection;
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
    pathSelection,
    kebabToPascalMap,
    kebabToCamelMap,
    pascalToKebabMap,
    camelToKebabMap,
    camelToPascalMap,
    pascalToCamelMap,
  } = opts;

  if (!block.for) {
    if (
      !evaluateConditions({
        context: parentContext,
        fileStructureCache,
        fileSystem,
        ifCondition: block.if,
        ifNotCondition: block.ifNot,
      })
    ) {
      return [];
    }
    if (
      isFileExcluded({
        context: parentContext,
        excludeFiles: block.excludeFiles,
        filePath: parentContext.path,
      })
    ) {
      return [];
    }
    return checkPredicates({
      context: parentContext,
      conventionName,
      fileStructureCache,
      fileSystem,
      must: block.must,
      mustNot: block.mustNot,
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
    camelToKebabMap,
    camelToPascalMap,
    candidatePaths:
      pathSelection?.mode === "targeted"
        ? pathSelection.selectedPaths
        : undefined,
    fileSystem,
    kebabToCamelMap,
    kebabToPascalMap,
    pascalToCamelMap,
    pascalToKebabMap,
    patterns: fullPatterns,
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
      fileSystem,
      matched: {
        path: entry.path,
        placeholders: mergedPlaceholders,
      },
      typescriptSession: parentContext.typescriptSession,
    });

    if (
      !evaluateConditions({
        context: forContext,
        fileStructureCache,
        fileSystem,
        ifCondition: block.if,
        ifNotCondition: block.ifNot,
      })
    ) {
      continue;
    }

    if (
      isFileExcluded({
        context: forContext,
        excludeFiles: block.excludeFiles,
        filePath: entry.path,
      })
    ) {
      continue;
    }

    diagnostics.push(
      ...checkPredicates({
        context: forContext,
        conventionName,
        fileStructureCache,
        fileSystem,
        must: block.must,
        mustNot: block.mustNot,
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
  pathSelection?: PathSelection;
  typescriptSession?: TypeScriptSession;
}): Promise<RunResult> {
  const typescriptSession = opts.typescriptSession ?? createTypeScriptSession();
  try {
    return await runWithSession({ ...opts, typescriptSession });
  } finally {
    if (!opts.typescriptSession) {
      typescriptSession.close();
    }
  }
}

async function runWithSession(opts: {
  config: ConfigV1;
  fileSystem: FileSystem;
  pathSelection?: PathSelection;
  typescriptSession: TypeScriptSession;
}): Promise<RunResult> {
  const startTime = performance.now();
  const { config, fileSystem, pathSelection } = opts;
  const fileStructureCache = new Map<string, FileStructure>();

  const { kebabToPascalMap, kebabToCamelMap } = config;
  const pascalToKebabMap = invertMap(kebabToPascalMap);
  const camelToKebabMap = invertMap(kebabToCamelMap);
  const camelToPascalMap = deriveCamelToPascalMap({
    kebabToCamelMap,
    kebabToPascalMap,
  });
  const pascalToCamelMap = invertMap(camelToPascalMap);

  const matchResults = await Promise.all(
    config.conventions.map((convention) => {
      const patterns = Array.isArray(convention.paths)
        ? convention.paths
        : [convention.paths];
      return matchPaths({
        camelToKebabMap,
        camelToPascalMap,
        candidatePaths:
          pathSelection?.mode === "targeted"
            ? pathSelection.structuralPaths
            : undefined,
        fileSystem,
        kebabToCamelMap,
        kebabToPascalMap,
        pascalToCamelMap,
        pascalToKebabMap,
        patterns,
      });
    })
  );

  const checkedPaths = new Set<string>();
  const diagnosticTasks: Promise<Diagnostic[]>[] = [];

  const caseMaps: CaseMaps = {
    camelToKebabMap,
    camelToPascalMap,
    kebabToCamelMap,
    kebabToPascalMap,
    pascalToCamelMap,
    pascalToKebabMap,
  };

  for (let i = 0; i < config.conventions.length; i += 1) {
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
      caseMaps,
      raw: convention.placeholders,
    });

    for (const entry of matched) {
      checkedPaths.add(entry.path);
      const mergedEntry: MatchedPath = {
        path: entry.path,
        placeholders: { ...staticPlaceholders, ...entry.placeholders },
      };
      const context = buildContext({
        fileSystem,
        matched: mergedEntry,
        typescriptSession: opts.typescriptSession,
      });

      if (
        isFileExcluded({
          context,
          excludeFiles: convention.excludeFiles,
          filePath: entry.path,
        })
      ) {
        continue;
      }

      if (
        !evaluateConditions({
          context,
          fileStructureCache,
          fileSystem,
          ifCondition: convention.if,
          ifNotCondition: convention.ifNot,
        })
      ) {
        continue;
      }

      for (const block of blocks) {
        diagnosticTasks.push(
          evaluateForBlock({
            block,
            camelToKebabMap,
            camelToPascalMap,
            checkedPaths,
            conventionName: resolveBlockConventionName({
              block,
              conventionName,
            }),
            fileStructureCache,
            fileSystem,
            kebabToCamelMap,
            kebabToPascalMap,
            parentContext: context,
            pascalToCamelMap,
            pascalToKebabMap,
            pathSelection,
            severity,
          })
        );
      }
    }
  }

  const diagnostics = (await Promise.all(diagnosticTasks)).flat();

  return {
    diagnostics,
    elapsed: performance.now() - startTime,
    filesChecked: checkedPaths.size,
  };
}
