import {
  compareVersions,
  getPrereleaseChannel,
  parseVersion,
} from "./semver.js";

const NPM_REGISTRY_URL = "https://registry.npmjs.org";
const DEFAULT_TIMEOUT_MS = 5000;

interface AbbreviatedPackageMetadata {
  versions: Record<string, unknown>;
}

export async function fetchLatestVersion(opts: {
  packageName: string;
  currentVersion: string;
  timeoutMs?: number;
}): Promise<string | null> {
  const timeout = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const channel = getPrereleaseChannel(opts.currentVersion);

  try {
    const response = await fetch(`${NPM_REGISTRY_URL}/${opts.packageName}`, {
      headers: { Accept: "application/vnd.npm.install-v1+json" },
      signal: AbortSignal.timeout(timeout),
    });

    if (!response.ok) {
      return null;
    }

    const data = (await response.json()) as AbbreviatedPackageMetadata;
    if (!data.versions || typeof data.versions !== "object") {
      return null;
    }

    const versions = Object.keys(data.versions);
    return findLatestInChannel({ versions, channel });
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
