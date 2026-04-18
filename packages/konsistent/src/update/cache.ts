import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

export interface UpdateCache {
  lastChecked: number;
  latestVersion: string;
}

const CACHE_FILENAME = 'update-check.json';
const DEFAULT_MAX_AGE_MS = 3 * 60 * 60 * 1000;

export function getCachePath(): string {
  const configHome =
    process.env.XDG_CONFIG_HOME || path.join(os.homedir(), '.config');
  return path.join(configHome, 'konsistent', CACHE_FILENAME);
}

export function readCache(): UpdateCache | null {
  try {
    const raw = fs.readFileSync(getCachePath(), 'utf-8');
    const data = JSON.parse(raw) as Record<string, unknown>;

    if (
      typeof data.lastChecked !== 'number' ||
      typeof data.latestVersion !== 'string'
    ) {
      return null;
    }

    return {
      lastChecked: data.lastChecked,
      latestVersion: data.latestVersion,
    };
  } catch {
    return null;
  }
}

export function writeCache(cache: UpdateCache): void {
  try {
    const cachePath = getCachePath();
    fs.mkdirSync(path.dirname(cachePath), { recursive: true });
    fs.writeFileSync(cachePath, JSON.stringify(cache), 'utf-8');
  } catch {
    // Silently ignore write failures (read-only fs, permissions, etc.)
  }
}

export function isCacheStale(opts: {
  cache: UpdateCache | null;
  maxAgeMs?: number;
}): boolean {
  if (!opts.cache) {
    return true;
  }
  const maxAge = opts.maxAgeMs ?? DEFAULT_MAX_AGE_MS;
  return Date.now() - opts.cache.lastChecked > maxAge;
}
