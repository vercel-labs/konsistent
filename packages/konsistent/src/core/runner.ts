import { dirname, join, posix } from 'node:path';
import type {
  ConfigV1,
  MustBlockV1,
  MustPredicatesV1,
} from '../config/schema.js';
import { checkHaveFiles } from '../predicates/have-files.js';
import { checkHaveType } from '../predicates/have-type.js';
import { parseFileStructure } from '../typescript/parser.js';
import { checkExportClasses } from '../typescript/predicates/export-classes.js';
import { checkExportConstants } from '../typescript/predicates/export-constants.js';
import { checkExportFunctions } from '../typescript/predicates/export-functions.js';
import { checkExportInterfaces } from '../typescript/predicates/export-interfaces.js';
import { checkExportTypes } from '../typescript/predicates/export-types.js';
import { checkExport } from '../typescript/predicates/export.js';
import { checkImportTypes } from '../typescript/predicates/import-types.js';
import { checkImport } from '../typescript/predicates/import.js';
import type { FileStructure } from '../typescript/types.js';
import type { PredicateContext } from './context.js';
import type { Diagnostic } from './diagnostics.js';
import type { FileSystem } from './filesystem.js';
import type { MatchedPath } from './path-matcher.js';
import { matchPaths } from './path-matcher.js';
import { resolveTemplate } from './template.js';

export const TS_PREDICATES = new Set([
  'export',
  'exportTypes',
  'exportConstants',
  'exportFunctions',
  'exportClasses',
  'exportInterfaces',
  'import',
  'importTypes',
]);

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

function evaluateCondition(opts: {
  block: MustBlockV1;
  context: PredicateContext;
}): boolean {
  const { block, context } = opts;
  if (!block.if) {
    return true;
  }
  const resolvedPath = context.resolveTemplate(block.if.hasFile);
  return context.fileExists(resolvedPath);
}

const TS_PREDICATE_HANDLERS: Record<
  string,
  (opts: {
    must: MustPredicatesV1;
    conventionName?: string;
    context: PredicateContext;
    fileStructure: FileStructure;
  }) => Diagnostic[]
> = {
  export: ({ must, context, fileStructure, conventionName }) =>
    must.export
      ? checkExport({
          expected: must.export,
          context,
          fileStructure,
          conventionName,
        })
      : [],
  exportTypes: ({ must, context, fileStructure, conventionName }) =>
    must.exportTypes
      ? checkExportTypes({
          expected: must.exportTypes,
          context,
          fileStructure,
          conventionName,
        })
      : [],
  exportConstants: ({ must, context, fileStructure, conventionName }) =>
    must.exportConstants
      ? checkExportConstants({
          expected: must.exportConstants,
          context,
          fileStructure,
          conventionName,
        })
      : [],
  exportFunctions: ({ must, context, fileStructure, conventionName }) =>
    must.exportFunctions
      ? checkExportFunctions({
          expected: must.exportFunctions,
          context,
          fileStructure,
          conventionName,
        })
      : [],
  exportClasses: ({ must, context, fileStructure, conventionName }) =>
    must.exportClasses
      ? checkExportClasses({
          expected: must.exportClasses,
          context,
          fileStructure,
          conventionName,
        })
      : [],
  exportInterfaces: ({ must, context, fileStructure, conventionName }) =>
    must.exportInterfaces
      ? checkExportInterfaces({
          expected: must.exportInterfaces,
          context,
          fileStructure,
          conventionName,
        })
      : [],
  import: ({ must, context, fileStructure, conventionName }) =>
    must.import
      ? checkImport({
          expected: must.import,
          context,
          fileStructure,
          conventionName,
        })
      : [],
  importTypes: ({ must, context, fileStructure, conventionName }) =>
    must.importTypes
      ? checkImportTypes({
          expected: must.importTypes,
          context,
          fileStructure,
          conventionName,
        })
      : [],
};

function checkTsPredicate(opts: {
  key: string;
  must: MustPredicatesV1;
  conventionName?: string;
  context: PredicateContext;
  fileStructure: FileStructure;
}): Diagnostic[] {
  const handler = TS_PREDICATE_HANDLERS[opts.key];
  if (!handler) {
    return [];
  }
  return handler(opts);
}

function checkPredicates(opts: {
  must: MustPredicatesV1;
  conventionName?: string;
  context: PredicateContext;
  fileSystem: FileSystem;
}): Diagnostic[] {
  const { must, conventionName, context, fileSystem } = opts;
  const diagnostics: Diagnostic[] = [];
  const keys = Object.keys(must);

  let fileStructure: ReturnType<typeof parseFileStructure> | undefined;

  const needsTs = keys.some((k) => TS_PREDICATES.has(k));
  if (needsTs) {
    const source = fileSystem.readFile(context.path);
    fileStructure = parseFileStructure({
      source,
      filePath: context.path,
    });
  }

  for (const key of keys) {
    if (key === 'haveType' && must.haveType) {
      diagnostics.push(
        ...checkHaveType({
          expected: must.haveType,
          context,
          fileSystem,
          conventionName,
        })
      );
    }
    if (key === 'haveFiles' && must.haveFiles) {
      diagnostics.push(
        ...checkHaveFiles({
          expected: must.haveFiles,
          context,
          conventionName,
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
}): Promise<Diagnostic[]> {
  const { block, parentContext, fileSystem, conventionName } = opts;

  if (!block.for) {
    return checkPredicates({
      must: block.must,
      conventionName,
      context: parentContext,
      fileSystem,
    });
  }

  const resolvedPattern = parentContext.resolveTemplate(block.for.files);

  const basePath = fileSystem.isDirectory(parentContext.path)
    ? parentContext.path
    : dirname(parentContext.path);

  const fullPattern = posix.join(basePath, resolvedPattern);
  const matched = await matchPaths({
    patterns: [fullPattern],
    fileSystem,
  });

  if (matched.length === 0) {
    return [];
  }

  const diagnostics: Diagnostic[] = [];
  for (const entry of matched) {
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

    diagnostics.push(
      ...checkPredicates({
        must: block.must,
        conventionName,
        context: forContext,
        fileSystem,
      })
    );
  }

  return diagnostics;
}

export async function run(opts: {
  config: ConfigV1;
  fileSystem: FileSystem;
}): Promise<Diagnostic[]> {
  const { config, fileSystem } = opts;
  const diagnostics: Diagnostic[] = [];

  for (const convention of config.conventions) {
    const patterns = Array.isArray(convention.paths)
      ? convention.paths
      : [convention.paths];

    const matched = await matchPaths({ patterns, fileSystem });
    const blocks = normalizeMustBlocks(convention.must);

    for (const entry of matched) {
      const context = buildContext({ matched: entry, fileSystem });

      for (const block of blocks) {
        if (!evaluateCondition({ block, context })) {
          continue;
        }
        diagnostics.push(
          ...(await evaluateForBlock({
            block,
            parentContext: context,
            fileSystem,
            conventionName: convention.name,
          }))
        );
      }
    }
  }

  return diagnostics;
}
