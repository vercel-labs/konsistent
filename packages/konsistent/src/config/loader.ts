import { readFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import {
  classifySource,
  extractPackageName,
  findPackageDir,
  isPathInside,
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
  cliPlaceholders?: Record<string, string>;
  configPackage?: string;
  configPath?: string;
}

const DECLARATION_REGEX =
  /\{([a-zA-Z][a-zA-Z0-9]*)(?::[a-zA-Z][a-zA-Z0-9]*(?:\([^}]*\))?)?\}/g;

function pathDeclaredNames(paths: string | string[]): Set<string> {
  const declared = new Set<string>();
  const entries = typeof paths === "string" ? [paths] : paths;
  for (const entry of entries) {
    for (const match of entry.matchAll(DECLARATION_REGEX)) {
      const [, name] = match;
      if (name !== undefined) {
        declared.add(name);
      }
    }
  }
  return declared;
}

function applyCliPlaceholders(opts: {
  conventions: ConfigV1["conventions"];
  identifiers: string[];
  cliPlaceholders: Record<string, string>;
}):
  | { success: true; conventions: ConfigV1["conventions"] }
  | { success: false; error: string } {
  const { conventions, identifiers, cliPlaceholders } = opts;
  const cliNames = Object.keys(cliPlaceholders);
  if (cliNames.length === 0) {
    return { conventions, success: true };
  }

  const errors: string[] = [];
  const next: ConfigV1["conventions"] = [];
  for (let i = 0; i < conventions.length; i += 1) {
    const convention = conventions[i];
    const identifier = identifiers[i] ?? `conventions[${i}]`;
    const declared = pathDeclaredNames(convention.paths);
    for (const name of cliNames) {
      if (declared.has(name)) {
        errors.push(
          `--placeholder "${name}:${cliPlaceholders[name]}" conflicts with convention "${identifier}" which captures "{${name}}" from paths. CLI placeholders may only override values in placeholders, not path-determined ones.`
        );
      }
    }
    next.push({
      ...convention,
      placeholders: { ...convention.placeholders, ...cliPlaceholders },
    });
  }

  if (errors.length > 0) {
    return { error: errors.join("\n"), success: false };
  }
  return { conventions: next, success: true };
}

export async function loadConfig(
  opts: LoadConfigOptions
): Promise<LoadConfigResult> {
  if (opts.configPath !== undefined && opts.configPackage !== undefined) {
    return {
      error:
        "Cannot use --config-path and --config-package together. Pass only one.",
      success: false,
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
    ({ filePath } = resolved);
  }

  let raw: string;
  try {
    raw = await readFile(filePath, "utf-8");
  } catch {
    return { error: `Could not read config file: ${filePath}`, success: false };
  }

  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    return {
      error: `Invalid JSON in config file: ${filePath}`,
      success: false,
    };
  }

  const result = ConfigV1Schema.safeParse(json);
  if (!result.success) {
    const issues = result.error.issues
      .map((issue) => `  - ${issue.path.join(".")}: ${issue.message}`)
      .join("\n");
    return { error: `Invalid config:\n${issues}`, success: false };
  }

  const parsed = result.data;
  const configDir = dirname(filePath);

  const sourcesResult = await resolveSources({
    configDir,
    conventionSources: parsed.conventionSources ?? {},
  });
  if (!sourcesResult.success) {
    return { error: sourcesResult.error, success: false };
  }

  const expansionResult = expandReferences({
    conventions: parsed.conventions,
    sourceMap: sourcesResult.sourceMap,
  });
  if (!expansionResult.success) {
    return { error: expansionResult.error, success: false };
  }

  const cliMerge = applyCliPlaceholders({
    cliPlaceholders: opts.cliPlaceholders ?? {},
    conventions: expansionResult.conventions,
    identifiers: expansionResult.identifiers,
  });
  if (!cliMerge.success) {
    return { error: cliMerge.error, success: false };
  }

  const placeholderResult = validatePlaceholders({
    conventions: cliMerge.conventions,
    identifiers: expansionResult.identifiers,
  });
  if (!placeholderResult.ok) {
    return { error: placeholderResult.error, success: false };
  }

  return {
    config: {
      ...parsed,
      conventions: cliMerge.conventions,
    },
    success: true,
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
      error: "--config-package value is empty. Pass an npm package name.",
      success: false,
    };
  }
  if (kind === "path") {
    return {
      error: `--config-package "${configPackage}" looks like a filesystem path. Use --config-path for filesystem paths.`,
      success: false,
    };
  }
  if (!isBarePackageName(configPackage)) {
    return {
      error: `--config-package "${configPackage}" includes a subpath. Pass only the package name (e.g. "${extractPackageName(configPackage)}").`,
      success: false,
    };
  }

  const packageName = extractPackageName(configPackage);
  const fromDir = process.cwd();
  const pkgDir = await findPackageDir({ fromDir, packageName });
  if (pkgDir === null) {
    return {
      error: `--config-package "${configPackage}": package is not installed in any node_modules above ${fromDir}. Add it as a (dev) dependency.`,
      success: false,
    };
  }

  const pkgJsonPath = join(pkgDir, "package.json");
  const attempted: string[] = [];

  let pkgJsonRaw: string;
  try {
    pkgJsonRaw = await readFile(pkgJsonPath, "utf-8");
  } catch {
    return {
      error: `--config-package "${configPackage}": could not read package.json at ${pkgJsonPath}.`,
      success: false,
    };
  }

  let pkgJson: unknown;
  try {
    pkgJson = JSON.parse(pkgJsonRaw);
  } catch {
    return {
      error: `--config-package "${configPackage}": malformed package.json at ${pkgJsonPath}.`,
      success: false,
    };
  }

  const explicit = readKonsistentField(pkgJson);
  if (explicit !== null) {
    const candidate = resolve(pkgDir, explicit);
    if (!isPathInside({ child: candidate, parent: pkgDir })) {
      return {
        error: `--config-package "${configPackage}": package.json "konsistent" field "${explicit}" resolves outside the package directory (${pkgDir}). The field must point to a path inside the package.`,
        success: false,
      };
    }
    attempted.push(`${candidate} (from package.json "konsistent" field)`);
    if (await pathExists(candidate)) {
      return { filePath: candidate, success: true };
    }
  }

  const distCandidate = join(pkgDir, "dist", CONFIG_FILENAME);
  attempted.push(distCandidate);
  if (await pathExists(distCandidate)) {
    return { filePath: distCandidate, success: true };
  }

  const rootCandidate = join(pkgDir, CONFIG_FILENAME);
  attempted.push(rootCandidate);
  if (await pathExists(rootCandidate)) {
    return { filePath: rootCandidate, success: true };
  }

  return {
    error: `--config-package "${configPackage}": no konsistent.json found in package. Looked at:\n${attempted
      .map((p) => `  - ${p}`)
      .join("\n")}`,
    success: false,
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
