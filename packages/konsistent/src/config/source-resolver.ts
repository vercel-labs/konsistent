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

  const resolvedSources = await Promise.all(
    Object.entries(conventionSources).map(
      async ([prefix, value]): Promise<{
        prefix: string;
        loaded: LoadResult;
      }> => {
        const kind = classifySource(value);
        if (kind === "empty") {
          return {
            loaded: {
              error: `Convention source "${prefix}" has empty value.`,
              success: false,
            },
            prefix,
          };
        }

        const loaded =
          kind === "path"
            ? await loadFromPath({ configDir, prefix, value })
            : await loadFromNpm({ configDir, prefix, specifier: value });
        return { loaded, prefix };
      }
    )
  );

  for (const { prefix, loaded } of resolvedSources) {
    if (!loaded.success) {
      return { error: loaded.error, success: false };
    }

    const conventionMap = new Map<string, ReusableConventionV1>();
    for (const convention of loaded.pkg.conventions) {
      conventionMap.set(convention.name, convention);
    }
    sourceMap.set(prefix, conventionMap);
  }

  return { sourceMap, success: true };
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
      error: `Convention source "${prefix}" → "${value}": could not read file at ${resolvedPath}.`,
      success: false,
    };
  }

  return parseAndValidate({
    locationLabel: resolvedPath,
    prefix,
    raw,
    sourceLabel: `"${value}"`,
  });
}

async function loadFromNpm(opts: {
  prefix: string;
  specifier: string;
  configDir: string;
}): Promise<LoadResult> {
  const { prefix, specifier, configDir } = opts;

  const packageName = extractPackageName(specifier);
  const pkgDir = await findPackageDir({ fromDir: configDir, packageName });
  if (pkgDir === null) {
    return {
      error: `Convention source "${prefix}" → "${specifier}": could not resolve npm package "${specifier}". The package may not be installed under the consumer's project.`,
      success: false,
    };
  }

  const pkgJsonPath = join(pkgDir, "package.json");
  let pkgJsonRaw: string;
  try {
    pkgJsonRaw = await readFile(pkgJsonPath, "utf-8");
  } catch {
    return {
      error: `Convention source "${prefix}" → "${specifier}": could not read package.json at ${pkgJsonPath}.`,
      success: false,
    };
  }

  let pkgJson: unknown;
  try {
    pkgJson = JSON.parse(pkgJsonRaw);
  } catch {
    return {
      error: `Convention source "${prefix}" → "${specifier}": malformed package.json at ${pkgJsonPath}.`,
      success: false,
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
      error: `Convention source "${prefix}" → "${specifier}": package does not declare an exports["./konsistent"] entry.`,
      success: false,
    };
  }

  const conventionsPath = resolvePath(pkgDir, resolved[0]);

  if (!isPathInside({ child: conventionsPath, parent: pkgDir })) {
    return {
      error: `Convention source "${prefix}" → "${specifier}": exports["./konsistent"] entry "${resolved[0]}" resolves outside the package directory (${pkgDir}). The entry must point to a path inside the package.`,
      success: false,
    };
  }

  let raw: string;
  try {
    raw = await readFile(conventionsPath, "utf-8");
  } catch {
    return {
      error: `Convention source "${prefix}" → "${specifier}": could not read file at ${conventionsPath} (resolved from exports["./konsistent"]).`,
      success: false,
    };
  }

  return parseAndValidate({
    locationLabel: conventionsPath,
    prefix,
    raw,
    sourceLabel: `"${specifier}"`,
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
      error: `Convention source "${prefix}" → ${sourceLabel}: malformed JSON at ${locationLabel}.`,
      success: false,
    };
  }

  const parsed = ReusableConventionsPackageV1Schema.safeParse(json);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((issue) => `  - ${issue.path.join(".")}: ${issue.message}`)
      .join("\n");
    return {
      error: `Convention source "${prefix}" → ${sourceLabel}: invalid reusable-convention package at ${locationLabel}:\n${issues}`,
      success: false,
    };
  }

  return { pkg: parsed.data, success: true };
}
