import fs from "node:fs";
import os from "node:os";
import path from "node:path";

export interface UpdateCache {
  channel?: string;
  lastChecked: number;
  latestVersion: string;
  publishedAt?: number;
}

const CACHE_FILENAME = "update-check.json";
const DEFAULT_MAX_AGE_MS = 3 * 60 * 60 * 1000;

export function getCachePath(): string {
  const configHome =
    process.env.XDG_CONFIG_HOME || path.join(os.homedir(), ".config");
  return path.join(configHome, "konsistent", CACHE_FILENAME);
}

export function readCache(): UpdateCache | null {
  try {
    const raw = fs.readFileSync(getCachePath(), "utf-8");
    const data = JSON.parse(raw) as Record<string, unknown>;

    if (
      typeof data.lastChecked !== "number" ||
      !Number.isFinite(data.lastChecked) ||
      typeof data.latestVersion !== "string" ||
      !(
        data.publishedAt === null ||
        (typeof data.publishedAt === "number" &&
          Number.isFinite(data.publishedAt))
      ) ||
      !(data.channel === null || typeof data.channel === "string")
    ) {
      return null;
    }

    const cache: UpdateCache = {
      lastChecked: data.lastChecked,
      latestVersion: data.latestVersion,
    };
    if (typeof data.channel === "string") {
      cache.channel = data.channel;
    }
    if (typeof data.publishedAt === "number") {
      cache.publishedAt = data.publishedAt;
    }
    return cache;
  } catch {
    return null;
  }
}

export function writeCache(cache: UpdateCache): void {
  try {
    const cachePath = getCachePath();
    fs.mkdirSync(path.dirname(cachePath), { recursive: true });
    fs.writeFileSync(
      cachePath,
      JSON.stringify({
        channel: cache.channel ?? null,
        lastChecked: cache.lastChecked,
        latestVersion: cache.latestVersion,
        publishedAt: cache.publishedAt ?? null,
      }),
      "utf-8"
    );
  } catch {
    // Silently ignore write failures (read-only fs, permissions, etc.)
  }
}

export function isCacheStale(opts: {
  cache?: UpdateCache;
  maxAgeMs?: number;
}): boolean {
  if (!opts.cache) {
    return true;
  }
  const maxAge = opts.maxAgeMs ?? DEFAULT_MAX_AGE_MS;
  return Date.now() - opts.cache.lastChecked > maxAge;
}
