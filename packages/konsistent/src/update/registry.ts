import {
  compareVersions,
  getPrereleaseChannel,
  parseVersion,
} from "./semver.js";

const NPM_REGISTRY_URL = "https://registry.npmjs.org";
const DEFAULT_TIMEOUT_MS = 5000;

export interface LatestRelease {
  publishedAt?: number;
  version: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
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

    const data: unknown = await response.json();
    if (!(isRecord(data) && isRecord(data.versions))) {
      return null;
    }

    const versions = Object.keys(data.versions);
    const channelOptions: { versions: string[]; channel?: string } = {
      versions,
    };
    if (channel !== null) {
      channelOptions.channel = channel;
    }
    const version = findLatestInChannel(channelOptions);
    if (!version) {
      return null;
    }
    const timestamp = isRecord(data.time) ? data.time[version] : undefined;
    const publishedAt =
      typeof timestamp === "string" ? Date.parse(timestamp) : Number.NaN;
    const latestRelease: LatestRelease = {
      version,
    };
    if (Number.isFinite(publishedAt)) {
      latestRelease.publishedAt = publishedAt;
    }
    return latestRelease;
  } catch {
    return null;
  }
}

export function findLatestInChannel(opts: {
  versions: string[];
  channel?: string;
}): string | null {
  let latestVersion: string | null = null;
  let latestParsed: NonNullable<ReturnType<typeof parseVersion>> | null = null;

  for (const version of opts.versions) {
    const parsed = parseVersion(version);
    if (!parsed) {
      continue;
    }

    if (opts.channel === undefined) {
      if (parsed.prereleaseTag !== undefined) {
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
