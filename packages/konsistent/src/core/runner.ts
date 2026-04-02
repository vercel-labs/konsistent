import { dirname, join } from 'node:path';
import type { ConfigV1, ConventionV1 } from '../config/schema.js';
import { checkHaveFiles } from '../predicates/have-files.js';
import { checkHaveType } from '../predicates/have-type.js';
import { parseFileStructure } from '../typescript/parser.js';
import { checkExportConstants } from '../typescript/predicates/export-constants.js';
import { checkExportFunctions } from '../typescript/predicates/export-functions.js';
import { checkExportInterfaces } from '../typescript/predicates/export-interfaces.js';
import { checkExportTypes } from '../typescript/predicates/export-types.js';
import { checkExport } from '../typescript/predicates/export.js';
import { checkImportTypes } from '../typescript/predicates/import-types.js';
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

function checkTsPredicate(opts: {
  key: string;
  convention: ConventionV1;
  context: PredicateContext;
  fileStructure: FileStructure;
}): Diagnostic[] {
  const { key, convention, context, fileStructure } = opts;
  const conventionName = convention.name;

  if (key === 'export' && convention.must.export) {
    return checkExport({
      expected: convention.must.export,
      context,
      fileStructure,
      conventionName,
    });
  }
  if (key === 'exportTypes' && convention.must.exportTypes) {
    return checkExportTypes({
      expected: convention.must.exportTypes,
      context,
      fileStructure,
      conventionName,
    });
  }
  if (key === 'exportConstants' && convention.must.exportConstants) {
    return checkExportConstants({
      expected: convention.must.exportConstants,
      context,
      fileStructure,
      conventionName,
    });
  }
  if (key === 'exportFunctions' && convention.must.exportFunctions) {
    return checkExportFunctions({
      expected: convention.must.exportFunctions,
      context,
      fileStructure,
      conventionName,
    });
  }
  if (key === 'exportInterfaces' && convention.must.exportInterfaces) {
    return checkExportInterfaces({
      expected: convention.must.exportInterfaces,
      context,
      fileStructure,
      conventionName,
    });
  }
  if (key === 'importTypes' && convention.must.importTypes) {
    return checkImportTypes({
      expected: convention.must.importTypes,
      context,
      fileStructure,
      conventionName,
    });
  }
  return [];
}

function checkPredicates(opts: {
  convention: ConventionV1;
  context: PredicateContext;
  fileSystem: FileSystem;
}): Diagnostic[] {
  const { convention, context, fileSystem } = opts;
  const diagnostics: Diagnostic[] = [];
  const keys = Object.keys(convention.must);

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
    if (key === 'haveType' && convention.must.haveType) {
      diagnostics.push(
        ...checkHaveType({
          expected: convention.must.haveType,
          context,
          fileSystem,
          conventionName: convention.name,
        })
      );
    }
    if (key === 'haveFiles' && convention.must.haveFiles) {
      diagnostics.push(
        ...checkHaveFiles({
          expected: convention.must.haveFiles,
          context,
          conventionName: convention.name,
        })
      );
    }
    if (fileStructure && TS_PREDICATES.has(key)) {
      diagnostics.push(
        ...checkTsPredicate({
          key,
          convention,
          context,
          fileStructure,
        })
      );
    }
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

    for (const entry of matched) {
      const context = buildContext({ matched: entry, fileSystem });
      diagnostics.push(...checkPredicates({ convention, context, fileSystem }));
    }
  }

  return diagnostics;
}
