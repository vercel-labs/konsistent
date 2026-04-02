import type { ConfigV1 } from '../config/schema.js';
import { checkHaveType } from '../predicates/have-type.js';
import type { PredicateContext } from './context.js';
import type { Diagnostic } from './diagnostics.js';
import type { FileSystem } from './filesystem.js';

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

    const matchedPaths = await fileSystem.glob(patterns);

    for (const matchedPath of matchedPaths) {
      const context: PredicateContext = {
        path: matchedPath,
        placeholders: {},
        resolveTemplate(template: string): string {
          return template;
        },
        fileExists(relativePath: string): boolean {
          return fileSystem.fileExists(relativePath);
        },
        readDir(relativePath: string): string[] {
          return fileSystem.readDir(relativePath);
        },
      };

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
      }
    }
  }

  return diagnostics;
}
