import type {
  MustBlockV1,
  MustPredicatesV1,
  ReusableConventionV1,
} from "@konsistent/convention";
import { MustBlockV1Schema } from "@konsistent/convention";
import type { ConventionV1, RawConfigV1 } from "./schema.js";
import { ConventionV1Schema } from "./schema.js";
import type { SourceMap } from "./source-resolver.js";

const STRING_REF_PATTERN = /^[a-z0-9-]+\/[a-z0-9-]+$/;

export type ExpandReferencesResult =
  | { success: true; conventions: ConventionV1[]; identifiers: string[] }
  | { success: false; error: string };

type UseRefEntry = { use: string } & Record<string, unknown>;

export function expandReferences(opts: {
  conventions: RawConfigV1["conventions"];
  sourceMap: SourceMap;
}): ExpandReferencesResult {
  const { conventions, sourceMap } = opts;
  const expanded: ConventionV1[] = [];
  const identifiers: string[] = [];

  for (let i = 0; i < conventions.length; i++) {
    const entry = conventions[i];

    if (typeof entry === "string") {
      const expandedResult = expandStringReference({
        ref: entry,
        index: i,
        sourceMap,
      });
      if (!expandedResult.success) {
        return expandedResult;
      }
      expanded.push(expandedResult.convention);
      identifiers.push(entry);
      continue;
    }

    if (entry && typeof entry === "object" && Object.hasOwn(entry, "use")) {
      const useRef = entry as UseRefEntry;
      const expandedResult = expandUseReference({
        entry: useRef,
        index: i,
        sourceMap,
      });
      if (!expandedResult.success) {
        return expandedResult;
      }
      expanded.push(expandedResult.convention);
      identifiers.push(useRef.use);
      continue;
    }

    const handWrittenResult = expandHandWritten({
      entry: entry as ConventionV1 & {
        must:
          | MustPredicatesV1
          | Array<
              string | MustBlockV1 | ({ use: string } & Record<string, unknown>)
            >;
      },
      index: i,
      sourceMap,
    });
    if (!handWrittenResult.success) {
      return handWrittenResult;
    }
    expanded.push(handWrittenResult.convention);
    identifiers.push(handWrittenResult.convention.name ?? `conventions[${i}]`);
  }

  return { success: true, conventions: expanded, identifiers };
}

function expandHandWritten(opts: {
  entry: ConventionV1 & {
    must:
      | MustPredicatesV1
      | Array<
          string | MustBlockV1 | ({ use: string } & Record<string, unknown>)
        >;
  };
  index: number;
  sourceMap: SourceMap;
}):
  | { success: true; convention: ConventionV1 }
  | { success: false; error: string } {
  const { entry, index, sourceMap } = opts;

  if (!Array.isArray(entry.must)) {
    return { success: true, convention: entry as ConventionV1 };
  }

  const resolvedBlocks: MustBlockV1[] = [];
  for (let j = 0; j < entry.must.length; j++) {
    const block = entry.must[j];
    if (typeof block === "string") {
      const expandedBlock = expandMustBlockReference({
        ref: block,
        overrides: {},
        conventionIndex: index,
        blockIndex: j,
        sourceMap,
      });
      if (!expandedBlock.success) {
        return expandedBlock;
      }
      resolvedBlocks.push(expandedBlock.block);
      continue;
    }
    if (block && typeof block === "object" && Object.hasOwn(block, "use")) {
      const { use, ...overrides } = block as { use: string } & Record<
        string,
        unknown
      >;
      const expandedBlock = expandMustBlockReference({
        ref: use,
        overrides,
        conventionIndex: index,
        blockIndex: j,
        sourceMap,
      });
      if (!expandedBlock.success) {
        return expandedBlock;
      }
      resolvedBlocks.push(expandedBlock.block);
      continue;
    }
    resolvedBlocks.push(block as MustBlockV1);
  }

  return {
    success: true,
    convention: { ...entry, must: resolvedBlocks } as ConventionV1,
  };
}

function expandMustBlockReference(opts: {
  ref: string;
  overrides: Record<string, unknown>;
  conventionIndex: number;
  blockIndex: number;
  sourceMap: SourceMap;
}): { success: true; block: MustBlockV1 } | { success: false; error: string } {
  const { ref, overrides, conventionIndex, blockIndex, sourceMap } = opts;
  const location = `conventions[${conventionIndex}].must[${blockIndex}]`;

  const lookup = lookupReusable({ ref, index: conventionIndex, sourceMap });
  if (!lookup.success) {
    return {
      success: false,
      error: lookup.error.replace(`conventions[${conventionIndex}]`, location),
    };
  }
  const { reusable, prefix, name } = lookup;

  const topLevelOnly: string[] = [];
  if (reusable.paths !== undefined) {
    topLevelOnly.push("paths");
  }
  if (reusable.severity !== undefined) {
    topLevelOnly.push("severity");
  }
  if (topLevelOnly.length > 0) {
    return {
      success: false,
      error: `Convention "${prefix}/${name}" referenced in ${location} declares top-level-only field(s) ${topLevelOnly
        .map((f) => `"${f}"`)
        .join(
          ", "
        )}. Such conventions can only be referenced at the top level of conventions[]. Either remove the field(s) from the source convention, or move the reference out of must[].`,
    };
  }

  const base: Record<string, unknown> = {
    must: reusable.must,
  };
  if (reusable.name !== undefined) {
    base.name = reusable.name;
  }
  if (reusable.description !== undefined) {
    base.description = reusable.description;
  }
  if (reusable.if !== undefined) {
    base.if = reusable.if;
  }
  if (reusable.for !== undefined) {
    base.for = reusable.for;
  }
  if (reusable.excludeFiles !== undefined) {
    base.excludeFiles = reusable.excludeFiles;
  }

  const merged = deepMerge({ base, override: overrides });

  const validated = MustBlockV1Schema.safeParse(merged);
  if (!validated.success) {
    const issues = validated.error.issues
      .map(
        (issue) =>
          `  - ${location}${issue.path.length > 0 ? `.${issue.path.join(".")}` : ""}: ${issue.message}`
      )
      .join("\n");
    return {
      success: false,
      error: `Expanded must-block reference "${prefix}/${name}" failed validation at ${location}:\n${issues}`,
    };
  }

  return { success: true, block: validated.data };
}

function lookupReusable(opts: {
  ref: string;
  index: number;
  sourceMap: SourceMap;
}):
  | {
      success: true;
      reusable: ReusableConventionV1;
      prefix: string;
      name: string;
    }
  | { success: false; error: string } {
  const { ref, index, sourceMap } = opts;

  if (!STRING_REF_PATTERN.test(ref)) {
    return {
      success: false,
      error: `Invalid convention reference "${ref}" in conventions[${index}]. Expected format "<vendor>/<name>".`,
    };
  }

  const [prefix, name] = ref.split("/") as [string, string];
  const conventionMap = sourceMap.get(prefix);
  if (!conventionMap) {
    return {
      success: false,
      error: `Unknown convention source "${prefix}" referenced in conventions[${index}]. Declare it in conventionSources or fix the typo.`,
    };
  }

  const reusable = conventionMap.get(name);
  if (!reusable) {
    const available = Array.from(conventionMap.keys()).join(", ");
    return {
      success: false,
      error: `No convention "${name}" in source "${prefix}". The package exports: ${available}.`,
    };
  }

  return { success: true, reusable, prefix, name };
}

function expandStringReference(opts: {
  ref: string;
  index: number;
  sourceMap: SourceMap;
}):
  | { success: true; convention: ConventionV1 }
  | { success: false; error: string } {
  const { ref, index, sourceMap } = opts;

  const lookup = lookupReusable({ ref, index, sourceMap });
  if (!lookup.success) {
    return lookup;
  }
  const { reusable, prefix, name } = lookup;

  const paths = reusable.paths;
  if (paths === undefined) {
    return {
      success: false,
      error: `Convention "${prefix}/${name}" cannot be referenced by string; it has no "paths". Use { use: "${prefix}/${name}", paths: [...] } form.`,
    };
  }

  const candidate: Record<string, unknown> = {
    name: reusable.name,
    description: reusable.description,
    paths,
    must: reusable.must,
  };
  if (reusable.severity !== undefined) {
    candidate.severity = reusable.severity;
  }
  if (reusable.excludeFiles !== undefined) {
    candidate.excludeFiles = reusable.excludeFiles;
  }

  const validated = ConventionV1Schema.safeParse(candidate);
  if (!validated.success) {
    const issues = validated.error.issues
      .map((issue) => `  - ${issue.path.join(".")}: ${issue.message}`)
      .join("\n");
    return {
      success: false,
      error: `Expanded convention "${prefix}/${name}" failed validation at conventions[${index}]:\n${issues}`,
    };
  }

  return { success: true, convention: validated.data };
}

function expandUseReference(opts: {
  entry: UseRefEntry;
  index: number;
  sourceMap: SourceMap;
}):
  | { success: true; convention: ConventionV1 }
  | { success: false; error: string } {
  const { entry, index, sourceMap } = opts;
  const ref = entry.use;

  const lookup = lookupReusable({ ref, index, sourceMap });
  if (!lookup.success) {
    return lookup;
  }
  const { reusable, prefix, name } = lookup;

  const { use: _use, ...overrides } = entry;

  const inheritedPaths = reusable.paths;
  const overridePaths = overrides.paths;
  if (inheritedPaths === undefined && overridePaths === undefined) {
    return {
      success: false,
      error: `Convention "${prefix}/${name}" referenced in conventions[${index}] has no "paths". Either the reusable convention must declare paths, or the override must supply paths.`,
    };
  }

  const base: Record<string, unknown> = {
    name: reusable.name,
    description: reusable.description,
    must: reusable.must,
  };
  if (reusable.severity !== undefined) {
    base.severity = reusable.severity;
  }
  if (reusable.paths !== undefined) {
    base.paths = reusable.paths;
  }
  if (reusable.excludeFiles !== undefined) {
    base.excludeFiles = reusable.excludeFiles;
  }

  const merged = deepMerge({ base, override: overrides });

  const validated = ConventionV1Schema.safeParse(merged);
  if (!validated.success) {
    const issues = validated.error.issues
      .map(
        (issue) =>
          `  - conventions.${index}${issue.path.length > 0 ? `.${issue.path.join(".")}` : ""}: ${issue.message}`
      )
      .join("\n");
    return {
      success: false,
      error: `Expanded convention "${prefix}/${name}" failed validation at conventions[${index}]:\n${issues}`,
    };
  }

  return { success: true, convention: validated.data };
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value) &&
    Object.getPrototypeOf(value) === Object.prototype
  );
}

function deepMerge(opts: {
  base: Record<string, unknown>;
  override: Record<string, unknown>;
}): Record<string, unknown> {
  const { base, override } = opts;
  const result: Record<string, unknown> = { ...base };

  for (const [key, overrideValue] of Object.entries(override)) {
    const baseValue = result[key];

    if (isPlainObject(baseValue) && isPlainObject(overrideValue)) {
      result[key] = deepMerge({ base: baseValue, override: overrideValue });
      continue;
    }

    result[key] = overrideValue;
  }

  return result;
}
