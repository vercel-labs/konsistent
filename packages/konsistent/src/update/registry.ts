import {
  compareVersions,
  getPrereleaseChannel,
  parseVersion,
} from "./semver.js";

const NPM_REGISTRY_URL = "https://registry.npmjs.org";
const DEFAULT_TIMEOUT_MS = 5000;

export interface LatestRelease {
  publishedAt: number | null;
  version: string;
}

interface PackageMetadata {
  time?: Record<string, unknown> | null;
  versions?: Record<string, unknown> | null;
}

export async function fetchLatestRelease(opts: {
  packageName: string;
  currentVersion: string;
  timeoutMs?: number;
}): Promise<LatestRelease | null> {
  const timeout = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const channel = getPrereleaseChannel(opts.currentVersion);

  try {
    const response = await fetch(`${NPM_REGISTRY_URL}/${opts.packageName}`, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(timeout),
    });

    if (!response.ok) {
      return null;
    }

    const data = (await response.json()) as PackageMetadata;
    if (
      !data.versions ||
      typeof data.versions !== "object" ||
      Array.isArray(data.versions)
    ) {
      return null;
    }

    const versions = Object.keys(data.versions);
    const version = findLatestInChannel({ channel, versions });
    if (!version) {
      return null;
    }
    const timestamp = data.time?.[version];
    const publishedAt =
      typeof timestamp === "string" ? Date.parse(timestamp) : Number.NaN;
    return {
      publishedAt: Number.isFinite(publishedAt) ? publishedAt : null,
      version,
    };
  } catch {
    return null;
  }
}

export function findLatestInChannel(opts: {
  versions: string[];
  channel: string | null;
}): string | null {
  let latestVersion: string | null = null;
  let latestParsed: NonNullable<ReturnType<typeof parseVersion>> | null = null;

  for (const version of opts.versions) {
    const parsed = parseVersion(version);
    if (!parsed) {
      continue;
    }

    if (opts.channel === null) {
      if (parsed.prereleaseTag !== null) {
        continue;
      }
    } else if (parsed.prereleaseTag !== opts.channel) {
      continue;
    }

    if (
      !latestParsed ||
      compareVersions({ a: parsed, b: latestParsed }) === 1
    ) {
      latestVersion = version;
      latestParsed = parsed;
    }
  }

  return latestVersion;
}
