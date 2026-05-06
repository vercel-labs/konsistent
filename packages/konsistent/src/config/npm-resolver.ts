import { stat } from "node:fs/promises";
import {
  dirname,
  isAbsolute,
  join,
  relative,
  resolve as resolvePath,
} from "node:path";

export type SourceKind = "path" | "npm" | "empty";

export function classifySource(value: string): SourceKind {
  if (value.trim() === "") {
    return "empty";
  }
  if (value.startsWith(".") || isAbsolute(value)) {
    return "path";
  }
  return "npm";
}

export function isPathInside(opts: { child: string; parent: string }): boolean {
  const { child, parent } = opts;
  const rel = relative(resolvePath(parent), resolvePath(child));
  if (rel === "") {
    return true;
  }
  return !(rel.startsWith("..") || isAbsolute(rel));
}

export async function pathExists(path: string): Promise<boolean> {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
}

export function extractPackageName(specifier: string): string {
  if (specifier.startsWith("@")) {
    const parts = specifier.split("/");
    return parts.slice(0, 2).join("/");
  }
  const slash = specifier.indexOf("/");
  return slash === -1 ? specifier : specifier.slice(0, slash);
}

export async function findPackageDir(opts: {
  packageName: string;
  fromDir: string;
}): Promise<string | null> {
  const { packageName, fromDir } = opts;

  let dir = resolvePath(fromDir);
  for (;;) {
    const candidate = join(dir, "node_modules", packageName);
    if (await pathExists(join(candidate, "package.json"))) {
      return candidate;
    }
    const parent = dirname(dir);
    if (parent === dir) {
      return null;
    }
    dir = parent;
  }
}
