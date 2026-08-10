import picomatch from "picomatch";
import type { FileSystem } from "./filesystem.js";
import { PlaceholderValue } from "./placeholder.js";
import {
  parsePlaceholderConstraint,
  validatePlaceholderConstraint,
} from "./placeholder-constraint.js";

/*
 * Matches placeholder expressions in path patterns, with optional inline constraints.
 *
 * Syntax variants:
 *   {name}                  — plain placeholder, no constraint
 *   {name:constraint}       — placeholder with a constraint (no argument)
 *   {name:constraint(arg)}  — placeholder with a constraint and an argument
 *
 * Examples:
 *   {providerId}                     — captures "providerId", no constraint
 *   {modelKind:segments(2)}          — captures "modelKind", constraint raw = "segments(2)"
 *   {providerId:matches(^[a-z]+ai$)} — captures "providerId", constraint raw = "matches(^[a-z]+ai$)"
 *
 * Capture groups:
 *   [1] — placeholder name       (e.g. "modelKind")
 *   [2] — raw constraint string  (e.g. "segments(2)"), undefined when no constraint
 *
 * Breakdown:
 *   \{                                — literal opening brace
 *   ([a-zA-Z][a-zA-Z0-9]*)            — group 1: placeholder name (letter, then alphanumeric)
 *   (?:                               — optional non-capturing group for constraint:
 *     :                               —   literal colon separator
 *     ([a-zA-Z][a-zA-Z0-9]*           —   group 2 start: constraint name
 *       (?:\([^}]*\))?                —     optional parenthesised argument (anything except `}`)
 *     )                               —   group 2 end
 *   )?                                — end optional constraint group
 *   }                                 — literal closing brace
 */
const PLACEHOLDER_REGEX =
  /\{([a-zA-Z][a-zA-Z0-9]*)(?::([a-zA-Z][a-zA-Z0-9]*(?:\([^}]*\))?))?}/g;
const TEMPLATE_IN_PATH_REGEX = /\$\{([a-zA-Z][a-zA-Z0-9]*)\}/g;
const VALID_VALUE_REGEX = /^[a-zA-Z0-9_-]+$/;
const ESCAPE_REGEX = /[.*+?^${}()|[\]\\]/g;

export interface MatchedPath {
  path: string;
  placeholders: Record<string, PlaceholderValue>;
}

function normalizeTemplatesInPath(pattern: string): string {
  TEMPLATE_IN_PATH_REGEX.lastIndex = 0;
  return pattern.replace(TEMPLATE_IN_PATH_REGEX, "{$1}");
}

export function hasPlaceholders(pattern: string): boolean {
  PLACEHOLDER_REGEX.lastIndex = 0;
  return PLACEHOLDER_REGEX.test(pattern);
}

export function patternToGlob(pattern: string): string {
  PLACEHOLDER_REGEX.lastIndex = 0;
  return pattern.replace(PLACEHOLDER_REGEX, "*");
}

interface CollectedPlaceholder {
  constraintRaw?: string;
  name: string;
}

function collectPlaceholders(segment: string): CollectedPlaceholder[] {
  PLACEHOLDER_REGEX.lastIndex = 0;
  const result: CollectedPlaceholder[] = [];
  let match = PLACEHOLDER_REGEX.exec(segment);
  while (match !== null) {
    result.push({
      name: match[1],
      constraintRaw: match[2],
    });
    match = PLACEHOLDER_REGEX.exec(segment);
  }
  return result;
}

interface ExtractedValues {
  constraints: Record<string, string>;
  values: Record<string, string>;
}

const GLOB_WILDCARD_REGEX = /[*?[\]]/;

function matchSegmentAsGlob(opts: {
  patternSegment: string;
  pathSegment: string;
}): boolean {
  const { patternSegment, pathSegment } = opts;
  const regexStr = patternSegment.replace(ESCAPE_REGEX, (ch) => {
    if (ch === "*") {
      return "[^/]*";
    }
    if (ch === "?") {
      return "[^/]";
    }
    return `\\${ch}`;
  });
  return new RegExp(`^${regexStr}$`).test(pathSegment);
}

function extractValueFromSegment(opts: {
  patternSegment: string;
  pathSegment: string;
}): ExtractedValues | null {
  const { patternSegment, pathSegment } = opts;
  const placeholders = collectPlaceholders(patternSegment);

  if (placeholders.length === 0) {
    if (patternSegment === pathSegment) {
      return { values: {}, constraints: {} };
    }
    if (GLOB_WILDCARD_REGEX.test(patternSegment)) {
      return matchSegmentAsGlob({ patternSegment, pathSegment })
        ? { values: {}, constraints: {} }
        : null;
    }
    return null;
  }

  const CAPTURE_MARKER = "\x00CAPTURE\x00";
  PLACEHOLDER_REGEX.lastIndex = 0;
  const withMarkers = patternSegment.replace(PLACEHOLDER_REGEX, CAPTURE_MARKER);
  const escaped = withMarkers.replace(ESCAPE_REGEX, (ch) => `\\${ch}`);
  const regexStr = escaped.replaceAll(CAPTURE_MARKER, "([a-zA-Z0-9_-]+)");
  const regex = new RegExp(`^${regexStr}$`);
  const segmentMatch = regex.exec(pathSegment);
  if (!segmentMatch) {
    return null;
  }

  const values: Record<string, string> = {};
  const constraints: Record<string, string> = {};
  for (let i = 0; i < placeholders.length; i++) {
    values[placeholders[i].name] = segmentMatch[i + 1];
    const { constraintRaw } = placeholders[i];
    if (constraintRaw) {
      constraints[placeholders[i].name] = constraintRaw;
    }
  }
  return { values, constraints };
}

function satisfiesConstraints(opts: {
  values: Record<string, string>;
  constraints: Record<string, string>;
}): boolean {
  for (const [name, raw] of Object.entries(opts.constraints)) {
    const constraint = parsePlaceholderConstraint(raw);
    if (
      constraint &&
      !validatePlaceholderConstraint({
        value: opts.values[name],
        constraint,
      })
    ) {
      return false;
    }
  }
  return true;
}

function mergeExtracted(opts: {
  existing: Record<string, string>;
  incoming: Record<string, string>;
}): boolean {
  for (const [name, value] of Object.entries(opts.incoming)) {
    if (!VALID_VALUE_REGEX.test(value)) {
      return false;
    }
    if (Object.hasOwn(opts.existing, name) && opts.existing[name] !== value) {
      return false;
    }
    opts.existing[name] = value;
  }
  return true;
}

function tryExtractPlaceholders(opts: {
  pattern: string;
  pathSegments: string[];
}): Record<string, string> | null {
  const { pattern, pathSegments } = opts;
  const patternSegments = pattern.split("/");
  if (patternSegments.length !== pathSegments.length) {
    return null;
  }

  const extracted: Record<string, string> = {};
  const allConstraints: Record<string, string> = {};
  for (let i = 0; i < patternSegments.length; i++) {
    const segmentResult = extractValueFromSegment({
      patternSegment: patternSegments[i],
      pathSegment: pathSegments[i],
    });
    if (segmentResult === null) {
      return null;
    }
    if (
      !mergeExtracted({ existing: extracted, incoming: segmentResult.values })
    ) {
      return null;
    }
    Object.assign(allConstraints, segmentResult.constraints);
  }

  if (
    !satisfiesConstraints({ values: extracted, constraints: allConstraints })
  ) {
    return null;
  }

  return extracted;
}

function matchCandidatePaths(opts: {
  patterns: string[];
  candidatePaths: readonly string[];
}): string[] {
  const isMatch = picomatch(opts.patterns);
  return opts.candidatePaths.filter((path) => isMatch(path));
}

function toPlaceholderMap(opts: {
  raw: Record<string, string>;
  kebabToPascalMap?: Record<string, string>;
  kebabToCamelMap?: Record<string, string>;
  pascalToKebabMap?: Record<string, string>;
  camelToKebabMap?: Record<string, string>;
  camelToPascalMap?: Record<string, string>;
  pascalToCamelMap?: Record<string, string>;
}): Record<string, PlaceholderValue> {
  const {
    raw,
    kebabToPascalMap,
    kebabToCamelMap,
    pascalToKebabMap,
    camelToKebabMap,
    camelToPascalMap,
    pascalToCamelMap,
  } = opts;
  const result: Record<string, PlaceholderValue> = {};
  for (const [name, value] of Object.entries(raw)) {
    result[name] = new PlaceholderValue({
      value,
      kebabToPascalMap,
      kebabToCamelMap,
      pascalToKebabMap,
      camelToKebabMap,
      camelToPascalMap,
      pascalToCamelMap,
    });
  }
  return result;
}

async function resolvePositivePatterns(opts: {
  patterns: string[];
  fileSystem: FileSystem;
  candidatePaths?: readonly string[];
  kebabToPascalMap?: Record<string, string>;
  kebabToCamelMap?: Record<string, string>;
  pascalToKebabMap?: Record<string, string>;
  camelToKebabMap?: Record<string, string>;
  camelToPascalMap?: Record<string, string>;
  pascalToCamelMap?: Record<string, string>;
}): Promise<MatchedPath[]> {
  const {
    patterns,
    fileSystem,
    candidatePaths,
    kebabToPascalMap,
    kebabToCamelMap,
    pascalToKebabMap,
    camelToKebabMap,
    camelToPascalMap,
    pascalToCamelMap,
  } = opts;

  if (patterns.length === 0) {
    return [];
  }

  const anyPlaceholders = patterns.some((p) => hasPlaceholders(p));
  if (!anyPlaceholders) {
    const paths =
      candidatePaths === undefined
        ? await fileSystem.glob(patterns)
        : matchCandidatePaths({ patterns, candidatePaths });
    return paths.map((p) => ({
      path: p.endsWith("/") ? p.slice(0, -1) : p,
      placeholders: {},
    }));
  }

  const globPatterns = patterns.map(patternToGlob);
  const matchedPaths =
    candidatePaths === undefined
      ? await fileSystem.glob(globPatterns)
      : matchCandidatePaths({
          patterns: globPatterns,
          candidatePaths,
        });
  const results: MatchedPath[] = [];

  for (const rawPath of matchedPaths) {
    const matchedPath = rawPath.endsWith("/") ? rawPath.slice(0, -1) : rawPath;
    const pathSegments = matchedPath.split("/");

    for (const pattern of patterns) {
      if (!hasPlaceholders(pattern)) {
        continue;
      }
      const extracted = tryExtractPlaceholders({ pattern, pathSegments });
      if (extracted !== null) {
        results.push({
          path: matchedPath,
          placeholders: toPlaceholderMap({
            raw: extracted,
            kebabToPascalMap,
            kebabToCamelMap,
            pascalToKebabMap,
            camelToKebabMap,
            camelToPascalMap,
            pascalToCamelMap,
          }),
        });
        break;
      }
    }
  }

  return results;
}

export async function matchPaths(opts: {
  patterns: string[];
  fileSystem: FileSystem;
  candidatePaths?: readonly string[];
  kebabToPascalMap?: Record<string, string>;
  kebabToCamelMap?: Record<string, string>;
  pascalToKebabMap?: Record<string, string>;
  camelToKebabMap?: Record<string, string>;
  camelToPascalMap?: Record<string, string>;
  pascalToCamelMap?: Record<string, string>;
}): Promise<MatchedPath[]> {
  const {
    patterns: rawPatterns,
    fileSystem,
    candidatePaths,
    kebabToPascalMap,
    kebabToCamelMap,
    pascalToKebabMap,
    camelToKebabMap,
    camelToPascalMap,
    pascalToCamelMap,
  } = opts;

  if (candidatePaths?.length === 0) {
    return [];
  }

  const positivePatterns: string[] = [];
  const negativePatterns: string[] = [];

  for (const p of rawPatterns) {
    const normalized = normalizeTemplatesInPath(p);
    if (normalized.startsWith("!")) {
      negativePatterns.push(normalized.slice(1));
    } else {
      positivePatterns.push(normalized);
    }
  }

  const positiveResults = await resolvePositivePatterns({
    patterns: positivePatterns,
    fileSystem,
    candidatePaths,
    kebabToPascalMap,
    kebabToCamelMap,
    pascalToKebabMap,
    camelToKebabMap,
    camelToPascalMap,
    pascalToCamelMap,
  });

  if (negativePatterns.length === 0) {
    return positiveResults;
  }

  const negativeGlobs = negativePatterns.map(patternToGlob);
  if (candidatePaths !== undefined) {
    const isNegativeMatch = picomatch(negativeGlobs);
    return positiveResults.filter((result) => {
      const pathAndAncestors = [result.path];
      let current = result.path;
      while (current.includes("/")) {
        current = current.slice(0, current.lastIndexOf("/"));
        pathAndAncestors.push(current);
      }
      return !pathAndAncestors.some((path) => isNegativeMatch(path));
    });
  }

  const negatedPaths = await fileSystem.glob(negativeGlobs);
  const excludePaths = negatedPaths.map((p) =>
    p.endsWith("/") ? p.slice(0, -1) : p
  );

  return positiveResults.filter(
    (r) =>
      !excludePaths.some((ex) => r.path === ex || r.path.startsWith(`${ex}/`))
  );
}
