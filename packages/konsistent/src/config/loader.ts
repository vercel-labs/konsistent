import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { validatePlaceholders } from "./placeholder-validator.js";
import { expandReferences } from "./reference-expander.js";
import type { ConfigV1 } from "./schema.js";
import { ConfigV1Schema } from "./schema.js";
import { resolveSources } from "./source-resolver.js";

const CONFIG_FILENAME = "konsistent.json";

export type LoadConfigResult =
  | { success: true; config: ConfigV1 }
  | { success: false; error: string };

export async function loadConfig(opts: {
  configPath?: string;
}): Promise<LoadConfigResult> {
  const filePath = opts.configPath ?? resolve(process.cwd(), CONFIG_FILENAME);

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
