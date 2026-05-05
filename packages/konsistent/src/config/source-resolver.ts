import { readFile, stat } from "node:fs/promises";
import { dirname, isAbsolute, join, resolve as resolvePath } from "node:path";
import {
  ReusableConventionsPackageV1Schema,
  type ReusableConventionV1,
} from "@konsistent/convention";
import { exports as resolveExportsField } from "resolve.exports";

export type SourceMap = Map<string, Map<string, ReusableConventionV1>>;

export type ResolveSourcesResult =
  | { success: true; sourceMap: SourceMap }
  | { success: false; error: string };

type SourceKind = "path" | "npm" | "empty";

function classifySource(value: string): SourceKind {
  if (value.trim() === "") {
    return "empty";
  }
  // values starting with "." or "/" → path-form; else → npm specifier
  if (value.startsWith(".") || isAbsolute(value)) {
    return "path";
  }
  return "npm";
}

export async function resolveSources(opts: {
  conventionSources: Record<string, string>;
  configDir: string;
}): Promise<ResolveSourcesResult> {
  const { conventionSources, configDir } = opts;
  const sourceMap: SourceMap = new Map();

  for (const [prefix, value] of Object.entries(conventionSources)) {
    const kind = classifySource(value);

    if (kind === "empty") {
      return {
        success: false,
        error: `Convention source "${prefix}" has empty value.`,
      };
    }

    let loaded: LoadResult;
    if (kind === "path") {
      loaded = await loadFromPath({ prefix, value, configDir });
    } else {
      loaded = await loadFromNpm({ prefix, specifier: value, configDir });
    }

    if (!loaded.success) {
      return { success: false, error: loaded.error };
    }

    const conventionMap = new Map<string, ReusableConventionV1>();
    for (const convention of loaded.pkg.conventions) {
      conventionMap.set(convention.name, convention);
    }
    sourceMap.set(prefix, conventionMap);
  }

  return { success: true, sourceMap };
}

type LoadResult =
  | {
      success: true;
      pkg: { conventions: ReusableConventionV1[] };
    }
  | { success: false; error: string };

async function loadFromPath(opts: {
  prefix: string;
  value: string;
  configDir: string;
}): Promise<LoadResult> {
  const { prefix, value, configDir } = opts;
  const resolvedPath = resolvePath(configDir, value);

  let raw: string;
  try {
    raw = await readFile(resolvedPath, "utf-8");
  } catch {
    return {
      success: false,
      error: `Convention source "${prefix}" → "${value}": could not read file at ${resolvedPath}.`,
    };
  }

  return parseAndValidate({
    prefix,
    sourceLabel: `"${value}"`,
    locationLabel: resolvedPath,
    raw,
  });
}

async function loadFromNpm(opts: {
  prefix: string;
  specifier: string;
  configDir: string;
}): Promise<LoadResult> {
  const { prefix, specifier, configDir } = opts;

  const pkgJsonPath = await findPackageJson({ specifier, fromDir: configDir });
  if (pkgJsonPath === null) {
    return {
      success: false,
      error: `Convention source "${prefix}" → "${specifier}": could not resolve npm package "${specifier}". The package may not be installed under the consumer's project.`,
    };
  }

  let pkgJsonRaw: string;
  try {
    pkgJsonRaw = await readFile(pkgJsonPath, "utf-8");
  } catch {
    return {
      success: false,
      error: `Convention source "${prefix}" → "${specifier}": could not read package.json at ${pkgJsonPath}.`,
    };
  }

  let pkgJson: unknown;
  try {
    pkgJson = JSON.parse(pkgJsonRaw);
  } catch {
    return {
      success: false,
      error: `Convention source "${prefix}" → "${specifier}": malformed package.json at ${pkgJsonPath}.`,
    };
  }

  let resolved: readonly string[] | undefined;
  try {
    const out = resolveExportsField(
      pkgJson as Parameters<typeof resolveExportsField>[0],
      "./konsistent",
      { conditions: ["konsistent"] }
    );
    resolved = out ?? undefined;
  } catch {
    resolved = undefined;
  }

  if (!resolved || resolved.length === 0) {
    return {
      success: false,
      error: `Convention source "${prefix}" → "${specifier}": package does not declare an exports["./konsistent"] entry.`,
    };
  }

  const pkgDir = dirname(pkgJsonPath);
  const conventionsPath = resolvePath(pkgDir, resolved[0]);

  let raw: string;
  try {
    raw = await readFile(conventionsPath, "utf-8");
  } catch {
    return {
      success: false,
      error: `Convention source "${prefix}" → "${specifier}": could not read file at ${conventionsPath} (resolved from exports["./konsistent"]).`,
    };
  }

  return parseAndValidate({
    prefix,
    sourceLabel: `"${specifier}"`,
    locationLabel: conventionsPath,
    raw,
  });
}

async function pathExists(path: string): Promise<boolean> {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
}

async function findPackageJson(opts: {
  specifier: string;
  fromDir: string;
}): Promise<string | null> {
  const { specifier, fromDir } = opts;
  const packageName = extractPackageName(specifier);

  let dir = resolvePath(fromDir);
  for (;;) {
    const candidate = join(dir, "node_modules", packageName, "package.json");
    if (await pathExists(candidate)) {
      return candidate;
    }
    const parent = dirname(dir);
    if (parent === dir) {
      return null;
    }
    dir = parent;
  }
}

function extractPackageName(specifier: string): string {
  if (specifier.startsWith("@")) {
    const parts = specifier.split("/");
    return parts.slice(0, 2).join("/");
  }
  const slash = specifier.indexOf("/");
  return slash === -1 ? specifier : specifier.slice(0, slash);
}

function parseAndValidate(opts: {
  prefix: string;
  sourceLabel: string;
  locationLabel: string;
  raw: string;
}): LoadResult {
  const { prefix, sourceLabel, locationLabel, raw } = opts;

  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    return {
      success: false,
      error: `Convention source "${prefix}" → ${sourceLabel}: malformed JSON at ${locationLabel}.`,
    };
  }

  const parsed = ReusableConventionsPackageV1Schema.safeParse(json);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((issue) => `  - ${issue.path.join(".")}: ${issue.message}`)
      .join("\n");
    return {
      success: false,
      error: `Convention source "${prefix}" → ${sourceLabel}: invalid reusable-convention package at ${locationLabel}:\n${issues}`,
    };
  }

  return { success: true, pkg: parsed.data };
}
