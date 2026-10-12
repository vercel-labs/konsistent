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

export function findPackageDir(opts: {
  packageName: string;
  fromDir: string;
}): Promise<string | null> {
  return findPackageDirUpward({
    dir: resolvePath(opts.fromDir),
    packageName: opts.packageName,
  });
}

async function findPackageDirUpward(opts: {
  dir: string;
  packageName: string;
}): Promise<string | null> {
  const candidate = join(opts.dir, "node_modules", opts.packageName);
  if (await pathExists(join(candidate, "package.json"))) {
    return candidate;
  }

  const parent = dirname(opts.dir);
  return parent === opts.dir
    ? null
    : findPackageDirUpward({ dir: parent, packageName: opts.packageName });
}
