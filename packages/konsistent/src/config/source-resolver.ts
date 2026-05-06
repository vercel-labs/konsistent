import { readFile } from "node:fs/promises";
import { join, resolve as resolvePath } from "node:path";
import {
  ReusableConventionsPackageV1Schema,
  type ReusableConventionV1,
} from "@konsistent/convention";
import { exports as resolveExportsField } from "resolve.exports";
import {
  classifySource,
  extractPackageName,
  findPackageDir,
  isPathInside,
} from "./npm-resolver.js";

export type SourceMap = Map<string, Map<string, ReusableConventionV1>>;

export type ResolveSourcesResult =
  | { success: true; sourceMap: SourceMap }
  | { success: false; error: string };

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

  const packageName = extractPackageName(specifier);
  const pkgDir = await findPackageDir({ packageName, fromDir: configDir });
  if (pkgDir === null) {
    return {
      success: false,
      error: `Convention source "${prefix}" → "${specifier}": could not resolve npm package "${specifier}". The package may not be installed under the consumer's project.`,
    };
  }

  const pkgJsonPath = join(pkgDir, "package.json");
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

  const conventionsPath = resolvePath(pkgDir, resolved[0]);

  if (!isPathInside({ child: conventionsPath, parent: pkgDir })) {
    return {
      success: false,
      error: `Convention source "${prefix}" → "${specifier}": exports["./konsistent"] entry "${resolved[0]}" resolves outside the package directory (${pkgDir}). The entry must point to a path inside the package.`,
    };
  }

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
