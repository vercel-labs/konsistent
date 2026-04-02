import { dirname, join } from 'node:path';
import type { ConfigV1, ConventionV1 } from '../config/schema.js';
import { checkHaveFiles } from '../predicates/have-files.js';
import { checkHaveType } from '../predicates/have-type.js';
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

function checkPredicates(opts: {
  convention: ConventionV1;
  context: PredicateContext;
  fileSystem: FileSystem;
}): Diagnostic[] {
  const { convention, context, fileSystem } = opts;
  const diagnostics: Diagnostic[] = [];

  for (const key of Object.keys(convention.must)) {
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
