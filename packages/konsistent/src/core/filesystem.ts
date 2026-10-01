import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { resolve } from "node:path";
import { glob, globSync, isDynamicPattern } from "tinyglobby";

export interface FileSystem {
  fileExists(path: string): boolean;
  glob(patterns: string[]): Promise<string[]>;
  isDirectory(path: string): boolean;
  isFile(path: string): boolean;
  readDir(path: string): string[];
  readFile(path: string): string;
}

export function createRealFileSystem(opts: { cwd: string }): FileSystem {
  const globCache = new Map<string, Promise<string[]>>();
  const filePatternCache = new Map<string, boolean>();

  return {
    glob(patterns: string[]): Promise<string[]> {
      const key = patterns.join("\x00");
      const cached = globCache.get(key);
      if (cached) {
        return cached;
      }

      const result = glob(patterns, {
        cwd: opts.cwd,
        expandDirectories: false,
        onlyFiles: false,
      });
      globCache.set(key, result);
      return result;
    },
    isDirectory(path: string): boolean {
      try {
        return statSync(resolve(opts.cwd, path)).isDirectory();
      } catch {
        return false;
      }
    },
    isFile(path: string): boolean {
      try {
        return statSync(resolve(opts.cwd, path)).isFile();
      } catch {
        return false;
      }
    },
    fileExists(path: string): boolean {
      if (existsSync(resolve(opts.cwd, path))) {
        return true;
      }
      if (!isDynamicPattern(path)) {
        return false;
      }

      const cached = filePatternCache.get(path);
      if (cached !== undefined) {
        return cached;
      }

      const matched =
        globSync({
          patterns: path,
          cwd: opts.cwd,
          expandDirectories: false,
          onlyFiles: true,
        }).length > 0;
      filePatternCache.set(path, matched);
      return matched;
    },
    readDir(path: string): string[] {
      try {
        return readdirSync(resolve(opts.cwd, path));
      } catch {
        return [];
      }
    },
    readFile(path: string): string {
      return readFileSync(resolve(opts.cwd, path), "utf-8");
    },
  };
}
