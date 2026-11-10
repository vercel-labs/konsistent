export interface ParsedVersion {
  major: number;
  minor: number;
  patch: number;
  prereleaseNum?: number;
  prereleaseTag?: string;
}

const VERSION_RE =
  /^(?<major>\d+)\.(?<minor>\d+)\.(?<patch>\d+)(?:-(?<prereleaseTag>[a-z]+)\.(?<prereleaseNum>\d+))?$/u;

export function parseVersion(version: string): ParsedVersion | null {
  const match = version.match(VERSION_RE);
  if (!match) {
    return null;
  }
  const { groups } = match;
  if (!groups) {
    return null;
  }

  const parsedVersion: ParsedVersion = {
    major: Number(groups.major),
    minor: Number(groups.minor),
    patch: Number(groups.patch),
  };
  if (
    groups.prereleaseTag !== undefined &&
    groups.prereleaseNum !== undefined
  ) {
    parsedVersion.prereleaseNum = Number(groups.prereleaseNum);
    parsedVersion.prereleaseTag = groups.prereleaseTag;
  }
  return parsedVersion;
}

export function compareVersions({
  a,
  b,
}: {
  a: ParsedVersion;
  b: ParsedVersion;
}): -1 | 0 | 1 {
  for (const field of ["major", "minor", "patch"] as const) {
    if (a[field] < b[field]) {
      return -1;
    }
    if (a[field] > b[field]) {
      return 1;
    }
  }

  const aPrereleaseTag = a.prereleaseTag ?? null;
  const bPrereleaseTag = b.prereleaseTag ?? null;

  if (aPrereleaseTag === null && bPrereleaseTag === null) {
    return 0;
  }
  if (aPrereleaseTag === null) {
    return 1;
  }
  if (bPrereleaseTag === null) {
    return -1;
  }

  if (aPrereleaseTag < bPrereleaseTag) {
    return -1;
  }
  if (aPrereleaseTag > bPrereleaseTag) {
    return 1;
  }

  const aNum = a.prereleaseNum ?? 0;
  const bNum = b.prereleaseNum ?? 0;
  if (aNum < bNum) {
    return -1;
  }
  if (aNum > bNum) {
    return 1;
  }

  return 0;
}

export function getPrereleaseChannel(version: string): string | null {
  const parsed = parseVersion(version);
  return parsed?.prereleaseTag ?? null;
}

export function isNewerVersion(opts: {
  current: string;
  candidate: string;
}): boolean {
  const a = parseVersion(opts.current);
  const b = parseVersion(opts.candidate);
  if (!(a && b)) {
    return false;
  }
  return compareVersions({ a: b, b: a }) === 1;
}

/*
 * Checks if a version satisfies a caret (^) range.
 * Only supports ^x.y.z and ^x.y.z-tag.n ranges, which is what
 * package managers write to package.json.
 *
 * Caret range rules:
 * - ^1.2.3  := >=1.2.3 <2.0.0
 * - ^0.2.3  := >=0.2.3 <0.3.0
 * - ^0.0.3  := >=0.0.3 <0.0.4
 * - Prerelease on the same [major, minor, patch] allows prerelease versions.
 */
export function versionSatisfiesRange(opts: {
  range: string;
  version: string;
}): boolean {
  const trimmed = opts.range.trim();
  if (!trimmed.startsWith("^")) {
    return false;
  }

  const rangeVersion = trimmed.slice(1);
  const base = parseVersion(rangeVersion);
  const target = parseVersion(opts.version);
  if (!(base && target)) {
    return false;
  }

  if (compareVersions({ a: target, b: base }) === -1) {
    return false;
  }

  if (base.major !== 0) {
    return target.major === base.major;
  }
  if (base.minor !== 0) {
    return target.major === 0 && target.minor === base.minor;
  }
  return (
    target.major === 0 && target.minor === 0 && target.patch === base.patch
  );
}
