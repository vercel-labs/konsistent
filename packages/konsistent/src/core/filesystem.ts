import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import { glob } from 'tinyglobby';

export interface FileSystem {
  glob(patterns: string[]): Promise<string[]>;
  isDirectory(path: string): boolean;
  isFile(path: string): boolean;
  fileExists(path: string): boolean;
  readDir(path: string): string[];
  readFile(path: string): string;
}

export function createRealFileSystem(opts: { cwd: string }): FileSystem {
  const globCache = new Map<string, Promise<string[]>>();

  return {
    glob(patterns: string[]): Promise<string[]> {
      const key = patterns.join('\x00');
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
      return existsSync(resolve(opts.cwd, path));
    },
    readDir(path: string): string[] {
      try {
        return readdirSync(resolve(opts.cwd, path));
      } catch {
        return [];
      }
    },
    readFile(path: string): string {
      return readFileSync(resolve(opts.cwd, path), 'utf-8');
    },
  };
}
