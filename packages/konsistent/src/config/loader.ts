import { readFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import {
  classifySource,
  extractPackageName,
  findPackageDir,
  pathExists,
} from "./npm-resolver.js";
import { validatePlaceholders } from "./placeholder-validator.js";
import { expandReferences } from "./reference-expander.js";
import type { ConfigV1 } from "./schema.js";
import { ConfigV1Schema } from "./schema.js";
import { resolveSources } from "./source-resolver.js";

const CONFIG_FILENAME = "konsistent.json";

export type LoadConfigResult =
  | { success: true; config: ConfigV1 }
  | { success: false; error: string };

export interface LoadConfigOptions {
  configPackage?: string;
  configPath?: string;
}

export async function loadConfig(
  opts: LoadConfigOptions
): Promise<LoadConfigResult> {
  if (opts.configPath !== undefined && opts.configPackage !== undefined) {
    return {
      success: false,
      error:
        "Cannot use --config-path and --config-package together. Pass only one.",
    };
  }

  let filePath: string;
  if (opts.configPackage === undefined) {
    filePath = opts.configPath ?? resolve(process.cwd(), CONFIG_FILENAME);
  } else {
    const resolved = await resolveConfigPackagePath({
      configPackage: opts.configPackage,
    });
    if (!resolved.success) {
      return resolved;
    }
    filePath = resolved.filePath;
  }

  let raw: string;
  try {
    raw = await readFile(filePath, "utf-8");
  } catch {
    return { success: false, error: `Could not read config file: ${filePath}` };
  }

  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    return {
      success: false,
      error: `Invalid JSON in config file: ${filePath}`,
    };
  }

  const result = ConfigV1Schema.safeParse(json);
  if (!result.success) {
    const issues = result.error.issues
      .map((issue) => `  - ${issue.path.join(".")}: ${issue.message}`)
      .join("\n");
    return { success: false, error: `Invalid config:\n${issues}` };
  }

  const parsed = result.data;
  const configDir = dirname(filePath);

  const sourcesResult = await resolveSources({
    conventionSources: parsed.conventionSources ?? {},
    configDir,
  });
  if (!sourcesResult.success) {
    return { success: false, error: sourcesResult.error };
  }

  const expansionResult = expandReferences({
    conventions: parsed.conventions,
    sourceMap: sourcesResult.sourceMap,
  });
  if (!expansionResult.success) {
    return { success: false, error: expansionResult.error };
  }

  const placeholderResult = validatePlaceholders({
    conventions: expansionResult.conventions,
    identifiers: expansionResult.identifiers,
  });
  if (!placeholderResult.ok) {
    return { success: false, error: placeholderResult.error };
  }

  return {
    success: true,
    config: {
      ...parsed,
      conventions: expansionResult.conventions,
    },
  };
}

type ResolvePackagePathResult =
  | { success: true; filePath: string }
  | { success: false; error: string };

async function resolveConfigPackagePath(opts: {
  configPackage: string;
}): Promise<ResolvePackagePathResult> {
  const { configPackage } = opts;

  const kind = classifySource(configPackage);
  if (kind === "empty") {
    return {
      success: false,
      error: "--config-package value is empty. Pass an npm package name.",
    };
  }
  if (kind === "path") {
    return {
      success: false,
      error: `--config-package "${configPackage}" looks like a filesystem path. Use --config-path for filesystem paths.`,
    };
  }
  if (!isBarePackageName(configPackage)) {
    return {
      success: false,
      error: `--config-package "${configPackage}" includes a subpath. Pass only the package name (e.g. "${extractPackageName(configPackage)}").`,
    };
  }

  const packageName = extractPackageName(configPackage);
  const fromDir = process.cwd();
  const pkgDir = await findPackageDir({ packageName, fromDir });
  if (pkgDir === null) {
    return {
      success: false,
      error: `--config-package "${configPackage}": package is not installed in any node_modules above ${fromDir}. Add it as a (dev) dependency.`,
    };
  }

  const pkgJsonPath = join(pkgDir, "package.json");
  const attempted: string[] = [];

  let pkgJsonRaw: string;
  try {
    pkgJsonRaw = await readFile(pkgJsonPath, "utf-8");
  } catch {
    return {
      success: false,
      error: `--config-package "${configPackage}": could not read package.json at ${pkgJsonPath}.`,
    };
  }

  let pkgJson: unknown;
  try {
    pkgJson = JSON.parse(pkgJsonRaw);
  } catch {
    return {
      success: false,
      error: `--config-package "${configPackage}": malformed package.json at ${pkgJsonPath}.`,
    };
  }

  const explicit = readKonsistentField(pkgJson);
  if (explicit !== null) {
    const candidate = resolve(pkgDir, explicit);
    attempted.push(`${candidate} (from package.json "konsistent" field)`);
    if (await pathExists(candidate)) {
      return { success: true, filePath: candidate };
    }
  }

  const distCandidate = join(pkgDir, "dist", CONFIG_FILENAME);
  attempted.push(distCandidate);
  if (await pathExists(distCandidate)) {
    return { success: true, filePath: distCandidate };
  }

  const rootCandidate = join(pkgDir, CONFIG_FILENAME);
  attempted.push(rootCandidate);
  if (await pathExists(rootCandidate)) {
    return { success: true, filePath: rootCandidate };
  }

  return {
    success: false,
    error: `--config-package "${configPackage}": no konsistent.json found in package. Looked at:\n${attempted
      .map((p) => `  - ${p}`)
      .join("\n")}`,
  };
}

function isBarePackageName(value: string): boolean {
  if (value.startsWith("@")) {
    return value.split("/").length === 2;
  }
  return !value.includes("/");
}

function readKonsistentField(pkgJson: unknown): string | null {
  if (
    typeof pkgJson === "object" &&
    pkgJson !== null &&
    Object.hasOwn(pkgJson, "konsistent")
  ) {
    const value = (pkgJson as { konsistent: unknown }).konsistent;
    if (typeof value === "string" && value.length > 0) {
      return value;
    }
  }
  return null;
}
