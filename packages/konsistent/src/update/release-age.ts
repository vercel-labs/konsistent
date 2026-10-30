import fs from "node:fs";
import path from "node:path";
import { valid } from "semver";
import { parse as parseToml } from "smol-toml";
import { parseDocument } from "yaml";
import { detectPackageManager } from "./package-manager.js";
import { PACKAGE_NAME } from "./package-name.js";

interface PnpmExclusion {
  name: string;
  versions: string[] | null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function parsePnpmExclusion(pattern: string): PnpmExclusion {
  const atIndex = pattern.indexOf("@", pattern.startsWith("@") ? 1 : 0);
  if (atIndex === -1) {
    return { name: pattern, versions: null };
  }
  const name = pattern.slice(0, atIndex);
  const versions = pattern
    .slice(atIndex + 1)
    .split("||")
    .map((version) => valid(version));
  if (name.includes("*") || versions.some((version) => version === null)) {
    throw new Error("Invalid minimumReleaseAgeExclude version selector");
  }
  return { name, versions: versions as string[] };
}

function matchesPnpmExclusion(opts: {
  exclusion: PnpmExclusion;
  latestVersion: string;
}): boolean {
  const negated = opts.exclusion.name.startsWith("!");
  const name = negated ? opts.exclusion.name.slice(1) : opts.exclusion.name;
  const pattern = name
    .split("*")
    .map((part) => part.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
    .join(".*");
  const matchesName = new RegExp(`^${pattern}$`).test(PACKAGE_NAME) !== negated;
  return (
    matchesName &&
    (opts.exclusion.versions === null ||
      opts.exclusion.versions.includes(opts.latestVersion))
  );
}

function parseMinimumReleaseAgeMs(opts: {
  data: unknown;
  packageManager: "bun" | "pnpm";
  latestVersion: string;
}): number | null {
  if (!isRecord(opts.data)) {
    return null;
  }
  const config = opts.packageManager === "bun" ? opts.data.install : opts.data;
  if (!isRecord(config)) {
    return null;
  }
  const age = config.minimumReleaseAge;
  const multiplier = opts.packageManager === "pnpm" ? 60_000 : 1000;
  if (
    age !== undefined &&
    (typeof age !== "number" || age < 0 || !Number.isFinite(age * multiplier))
  ) {
    return null;
  }
  const rawExclusions =
    opts.packageManager === "pnpm"
      ? config.minimumReleaseAgeExclude
      : config.minimumReleaseAgeExcludes;
  let exclusions: unknown = rawExclusions;
  if (rawExclusions === undefined) {
    exclusions = [];
  } else if (
    opts.packageManager === "pnpm" &&
    typeof rawExclusions === "string"
  ) {
    exclusions = [rawExclusions];
  }
  if (
    !(
      Array.isArray(exclusions) &&
      exclusions.every((value) => typeof value === "string")
    )
  ) {
    return null;
  }
  const excluded =
    opts.packageManager === "pnpm"
      ? exclusions.map(parsePnpmExclusion).some((exclusion) =>
          matchesPnpmExclusion({
            exclusion,
            latestVersion: opts.latestVersion,
          })
        )
      : exclusions.includes(PACKAGE_NAME);
  if (excluded) {
    return 0;
  }
  return typeof age === "number" ? age * multiplier : null;
}

export function readMinimumReleaseAgeMs(opts: {
  cwd: string;
  latestVersion: string;
}): number | null {
  try {
    const packageManager = detectPackageManager(opts.cwd);
    if (packageManager !== "pnpm" && packageManager !== "bun") {
      return null;
    }
    const filename =
      packageManager === "pnpm" ? "pnpm-workspace.yaml" : "bunfig.toml";
    const raw = fs.readFileSync(path.join(opts.cwd, filename), "utf-8");
    let data: unknown;
    if (packageManager === "pnpm") {
      const document = parseDocument(raw);
      if (document.errors.length > 0) {
        return null;
      }
      data = document.toJS();
    } else {
      data = parseToml(raw);
    }
    return parseMinimumReleaseAgeMs({
      data,
      latestVersion: opts.latestVersion,
      packageManager,
    });
  } catch {
    return null;
  }
}

export function isReleaseOldEnough(opts: {
  publishedAt: number | null;
  minimumReleaseAgeMs: number;
  now?: number;
}): boolean {
  return (
    opts.minimumReleaseAgeMs === 0 ||
    (opts.publishedAt !== null &&
      Number.isFinite(opts.publishedAt) &&
      (opts.now ?? Date.now()) - opts.publishedAt >= opts.minimumReleaseAgeMs)
  );
}
