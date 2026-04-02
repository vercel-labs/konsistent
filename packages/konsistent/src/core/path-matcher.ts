import type { FileSystem } from './filesystem.js';
import { PlaceholderValue } from './placeholder.js';

const PLACEHOLDER_REGEX = /\{([a-zA-Z][a-zA-Z0-9]*)\}/g;
const VALID_VALUE_REGEX = /^[a-zA-Z0-9_-]+$/;
const ESCAPE_REGEX = /[.*+?^${}()|[\]\\]/g;

export interface MatchedPath {
  path: string;
  placeholders: Record<string, PlaceholderValue>;
}

export function hasPlaceholders(pattern: string): boolean {
  PLACEHOLDER_REGEX.lastIndex = 0;
  return PLACEHOLDER_REGEX.test(pattern);
}

export function patternToGlob(pattern: string): string {
  PLACEHOLDER_REGEX.lastIndex = 0;
  return pattern.replace(PLACEHOLDER_REGEX, '*');
}

function collectPlaceholderNames(segment: string): string[] {
  PLACEHOLDER_REGEX.lastIndex = 0;
  const names: string[] = [];
  let match = PLACEHOLDER_REGEX.exec(segment);
  while (match !== null) {
    names.push(match[1]);
    match = PLACEHOLDER_REGEX.exec(segment);
  }
  return names;
}

function extractValueFromSegment(opts: {
  patternSegment: string;
  pathSegment: string;
}): Record<string, string> | null {
  const { patternSegment, pathSegment } = opts;
  const placeholderNames = collectPlaceholderNames(patternSegment);

  if (placeholderNames.length === 0) {
    return patternSegment === pathSegment ? {} : null;
  }

  const escaped = patternSegment.replace(ESCAPE_REGEX, (ch) => {
    if (ch === '{' || ch === '}') {
      return ch;
    }
    return `\\${ch}`;
  });
  PLACEHOLDER_REGEX.lastIndex = 0;
  const regexStr = escaped.replace(PLACEHOLDER_REGEX, '([a-zA-Z0-9_-]+)');
  const regex = new RegExp(`^${regexStr}$`);
  const segmentMatch = regex.exec(pathSegment);
  if (!segmentMatch) {
    return null;
  }

  const result: Record<string, string> = {};
  for (let i = 0; i < placeholderNames.length; i++) {
    result[placeholderNames[i]] = segmentMatch[i + 1];
  }
  return result;
}

function tryExtractPlaceholders(opts: {
  pattern: string;
  pathSegments: string[];
}): Record<string, string> | null {
  const { pattern, pathSegments } = opts;
  const patternSegments = pattern.split('/');
  if (patternSegments.length !== pathSegments.length) {
    return null;
  }

  const extracted: Record<string, string> = {};
  for (let i = 0; i < patternSegments.length; i++) {
    const segmentResult = extractValueFromSegment({
      patternSegment: patternSegments[i],
      pathSegment: pathSegments[i],
    });
    if (segmentResult === null) {
      return null;
    }
    for (const [name, value] of Object.entries(segmentResult)) {
      if (!VALID_VALUE_REGEX.test(value)) {
        return null;
      }
      if (name in extracted && extracted[name] !== value) {
        return null;
      }
      extracted[name] = value;
    }
  }
  return extracted;
}

function toPlaceholderMap(
  raw: Record<string, string>
): Record<string, PlaceholderValue> {
  const result: Record<string, PlaceholderValue> = {};
  for (const [name, value] of Object.entries(raw)) {
    result[name] = new PlaceholderValue({ value });
  }
  return result;
}

export async function matchPaths(opts: {
  patterns: string[];
  fileSystem: FileSystem;
}): Promise<MatchedPath[]> {
  const { patterns, fileSystem } = opts;

  const anyPlaceholders = patterns.some((p) => hasPlaceholders(p));
  if (!anyPlaceholders) {
    const paths = await fileSystem.glob(patterns);
    return paths.map((p) => ({ path: p, placeholders: {} }));
  }

  const globPatterns = patterns.map(patternToGlob);
  const matchedPaths = await fileSystem.glob(globPatterns);
  const results: MatchedPath[] = [];

  for (const matchedPath of matchedPaths) {
    const pathSegments = matchedPath.split('/');

    for (const pattern of patterns) {
      if (!hasPlaceholders(pattern)) {
        continue;
      }
      const extracted = tryExtractPlaceholders({ pattern, pathSegments });
      if (extracted !== null) {
        results.push({
          path: matchedPath,
          placeholders: toPlaceholderMap(extracted),
        });
        break;
      }
    }
  }

  return results;
}
