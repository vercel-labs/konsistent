const NAME_REGEX = /^[a-zA-Z][a-zA-Z0-9]*$/;
const VALUE_REGEX = /^[a-zA-Z0-9_-]+$/;

export type ParseCliPlaceholdersResult =
  | { success: true; placeholders: Record<string, string> }
  | { success: false; error: string };

export function parseCliPlaceholders(opts: {
  raw: readonly string[];
}): ParseCliPlaceholdersResult {
  const result: Record<string, string> = {};
  for (const entry of opts.raw) {
    const colon = entry.indexOf(":");
    if (colon < 1 || colon === entry.length - 1) {
      return {
        success: false,
        error: `Invalid --placeholder "${entry}". Expected format "name:value".`,
      };
    }
    const name = entry.slice(0, colon);
    const value = entry.slice(colon + 1);
    if (!NAME_REGEX.test(name)) {
      return {
        success: false,
        error: `Invalid --placeholder "${entry}": name "${name}" must match [a-zA-Z][a-zA-Z0-9]*.`,
      };
    }
    if (!VALUE_REGEX.test(value)) {
      return {
        success: false,
        error: `Invalid --placeholder "${entry}": value "${value}" must match [a-zA-Z0-9_-]+.`,
      };
    }
    result[name] = value;
  }
  return { success: true, placeholders: result };
}

export function normalizePlaceholderArg(raw: unknown): string[] {
  if (raw === undefined || raw === null) {
    return [];
  }
  if (Array.isArray(raw)) {
    return raw.filter((item): item is string => typeof item === "string");
  }
  if (typeof raw === "string") {
    return [raw];
  }
  return [];
}
