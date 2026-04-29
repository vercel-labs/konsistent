import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import type { ConfigV1 } from "./schema.js";
import { ConfigV1Schema } from "./schema.js";

const CONFIG_FILENAME = "konsistent.json";

export async function loadConfig(opts: {
  configPath?: string;
}): Promise<{ config: ConfigV1 } | { error: string }> {
  const filePath = opts.configPath ?? resolve(process.cwd(), CONFIG_FILENAME);

  let raw: string;
  try {
    raw = await readFile(filePath, "utf-8");
  } catch {
    return { error: `Could not read config file: ${filePath}` };
  }

  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    return { error: `Invalid JSON in config file: ${filePath}` };
  }

  const result = ConfigV1Schema.safeParse(json);
  if (!result.success) {
    const issues = result.error.issues
      .map((issue) => `  - ${issue.path.join(".")}: ${issue.message}`)
      .join("\n");
    return { error: `Invalid config:\n${issues}` };
  }

  return { config: result.data };
}
