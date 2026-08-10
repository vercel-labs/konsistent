import { isAbsolute, posix, relative, resolve, sep } from "node:path";
import picomatch from "picomatch";
import { escapePath } from "tinyglobby";
import type { FileSystem } from "./filesystem.js";

export type PathSelection =
  | { mode: "all" }
  | {
      mode: "targeted";
      selectedPaths: readonly string[];
      structuralPaths: readonly string[];
    };

export const allPathSelection: PathSelection = { mode: "all" };

function normalizePath(opts: { cwd: string; path: string }): string {
  const absolutePath = isAbsolute(opts.path)
    ? opts.path
    : resolve(opts.cwd, opts.path);
  const relativePath = relative(opts.cwd, absolutePath);
  if (
    relativePath === ".." ||
    relativePath.startsWith(`..${sep}`) ||
    isAbsolute(relativePath)
  ) {
    throw new Error(
      `Path selector must stay within the current directory: ${opts.path}`
    );
  }
  if (relativePath === "") {
    return ".";
  }
  return relativePath.split(sep).join("/");
}

function ancestorsOf(path: string): string[] {
  const ancestors: string[] = [];
  let current = path;
  while (current !== ".") {
    current = posix.dirname(current);
    ancestors.push(current);
  }
  return ancestors;
}

export function createTargetedPathSelection(opts: {
  selectedPaths: Iterable<string>;
}): PathSelection {
  const selectedPaths = [...new Set(opts.selectedPaths)].sort();
  const structuralPaths = new Set(selectedPaths);
  for (const path of selectedPaths) {
    for (const ancestor of ancestorsOf(path)) {
      structuralPaths.add(ancestor);
    }
  }
  return {
    mode: "targeted",
    selectedPaths,
    structuralPaths: [...structuralPaths].sort(),
  };
}

function expandDirectory(opts: {
  path: string;
  fileSystem: FileSystem;
}): Promise<string[]> {
  const escapedPath = escapePath(opts.path);
  return opts.fileSystem.glob([`${escapedPath}/**`]);
}

async function expandPositiveSelector(opts: {
  selector: string;
  fileSystem: FileSystem;
}): Promise<string[]> {
  if (opts.fileSystem.isFile(opts.selector)) {
    return [opts.selector];
  }
  if (opts.fileSystem.isDirectory(opts.selector)) {
    return [
      opts.selector,
      ...(await expandDirectory({
        path: opts.selector,
        fileSystem: opts.fileSystem,
      })),
    ];
  }

  const matches = await opts.fileSystem.glob([opts.selector]);
  const directories = matches
    .filter((path) => opts.fileSystem.isDirectory(path))
    .sort((left, right) => left.length - right.length)
    .filter(
      (path, index, paths) =>
        !paths.slice(0, index).some((parent) => path.startsWith(`${parent}/`))
    );
  const descendants = await Promise.all(
    directories.map((path) =>
      expandDirectory({ path, fileSystem: opts.fileSystem })
    )
  );
  return [...matches, ...descendants.flat()];
}

function isExcluded(opts: {
  path: string;
  matchers: Array<(path: string) => boolean>;
}): boolean {
  if (opts.matchers.length === 0) {
    return false;
  }
  return [opts.path, ...ancestorsOf(opts.path)].some((path) =>
    opts.matchers.some((matcher) => matcher(path))
  );
}

export async function resolvePathSelectors(opts: {
  selectors: string[];
  cwd: string;
  fileSystem: FileSystem;
}): Promise<PathSelection> {
  const positiveSelectors = new Set<string>();
  const negativeSelectors = new Set<string>();

  for (const rawSelector of opts.selectors) {
    const normalizedLiteral = normalizePath({
      cwd: opts.cwd,
      path: rawSelector,
    });
    if (
      opts.fileSystem.isFile(normalizedLiteral) ||
      opts.fileSystem.isDirectory(normalizedLiteral)
    ) {
      positiveSelectors.add(normalizedLiteral);
      continue;
    }

    if (rawSelector.startsWith("!")) {
      const negativeValue = rawSelector.slice(1);
      if (negativeValue.length === 0) {
        throw new Error("Path selector must not be empty");
      }
      negativeSelectors.add(
        normalizePath({ cwd: opts.cwd, path: negativeValue })
      );
    } else {
      positiveSelectors.add(normalizedLiteral);
    }
  }

  if (positiveSelectors.size === 0) {
    throw new Error("--paths requires at least one positive path selector");
  }

  const matches = await Promise.all(
    [...positiveSelectors].map((selector) =>
      expandPositiveSelector({ selector, fileSystem: opts.fileSystem })
    )
  );
  const negativeMatchers = [...negativeSelectors].map((pattern) => {
    const matcher = picomatch(pattern);
    return (path: string) => matcher(path);
  });
  const selectedPaths = new Set(
    matches
      .flat()
      .map((path) => (path.endsWith("/") ? path.slice(0, -1) : path))
      .filter((path) => !isExcluded({ path, matchers: negativeMatchers }))
  );

  return createTargetedPathSelection({ selectedPaths });
}
