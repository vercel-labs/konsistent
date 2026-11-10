import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getCachePath, isCacheStale, readCache, writeCache } from "./cache.js";

let tmpDir: string;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "konsistent-cache-test-"));
  vi.stubEnv("XDG_CONFIG_HOME", tmpDir);
});

afterEach(() => {
  vi.unstubAllEnvs();
  fs.rmSync(tmpDir, { force: true, recursive: true });
});

describe("getCachePath", () => {
  it("uses XDG_CONFIG_HOME when set", () => {
    expect(getCachePath()).toBe(
      path.join(tmpDir, "konsistent", "update-check.json")
    );
  });

  it("falls back to ~/.config when XDG_CONFIG_HOME is unset", () => {
    vi.stubEnv("XDG_CONFIG_HOME", "");
    expect(getCachePath()).toBe(
      path.join(os.homedir(), ".config", "konsistent", "update-check.json")
    );
  });
});

describe("readCache", () => {
  it("returns null when file does not exist", () => {
    expect(readCache()).toBeNull();
  });

  it("returns null for malformed JSON", () => {
    const dir = path.join(tmpDir, "konsistent");
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, "update-check.json"), "not json");
    expect(readCache()).toBeNull();
  });

  it("returns null for missing fields", () => {
    const dir = path.join(tmpDir, "konsistent");
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(
      path.join(dir, "update-check.json"),
      JSON.stringify({ lastChecked: 123 })
    );
    expect(readCache()).toBeNull();
  });

  it("reads a valid cache file", () => {
    const dir = path.join(tmpDir, "konsistent");
    fs.mkdirSync(dir, { recursive: true });
    const data = {
      channel: null,
      lastChecked: 1000,
      latestVersion: "1.0.0",
      publishedAt: 500,
    };
    fs.writeFileSync(path.join(dir, "update-check.json"), JSON.stringify(data));
    expect(readCache()).toEqual({
      lastChecked: data.lastChecked,
      latestVersion: data.latestVersion,
      publishedAt: data.publishedAt,
    });
  });

  it("invalidates legacy cache entries", () => {
    fs.mkdirSync(path.dirname(getCachePath()), { recursive: true });
    fs.writeFileSync(
      getCachePath(),
      JSON.stringify({ lastChecked: Date.now(), latestVersion: "1.0.0" })
    );
    expect(readCache()).toBeNull();
  });

  it("preserves the serialized unknown-time sentinel and omits it from the API", () => {
    const data = {
      channel: "beta",
      lastChecked: 1000,
      latestVersion: "1.0.0-beta.14",
    };
    writeCache(data);
    expect(JSON.parse(fs.readFileSync(getCachePath(), "utf-8"))).toEqual({
      ...data,
      publishedAt: null,
    });
    expect(readCache()).toEqual(data);
  });

  it.each([
    { channel: 1, publishedAt: 1000 },
    { channel: null, publishedAt: "1000" },
    { channel: null },
    { publishedAt: 1000 },
  ])("rejects malformed cache metadata %j", (metadata) => {
    fs.mkdirSync(path.dirname(getCachePath()), { recursive: true });
    fs.writeFileSync(
      getCachePath(),
      JSON.stringify({ lastChecked: 2000, latestVersion: "1.0.0", ...metadata })
    );
    expect(readCache()).toBeNull();
  });
});

describe("writeCache", () => {
  it("creates directory and writes file", () => {
    const cache = {
      lastChecked: Date.now(),
      latestVersion: "2.0.0",
      publishedAt: 500,
    };
    writeCache(cache);

    const raw = fs.readFileSync(getCachePath(), "utf-8");
    expect(JSON.parse(raw)).toEqual({ ...cache, channel: null });
  });

  it("does not throw on write failure", () => {
    vi.stubEnv("XDG_CONFIG_HOME", "/nonexistent/readonly/path");
    expect(() =>
      writeCache({
        lastChecked: 1,
        latestVersion: "1.0.0",
        publishedAt: 0,
      })
    ).not.toThrow();
  });
});

describe("isCacheStale", () => {
  it("returns true when cache is absent", () => {
    expect(isCacheStale({})).toBe(true);
  });

  it("returns true when cache is older than max age", () => {
    const old = {
      lastChecked: Date.now() - 4 * 60 * 60 * 1000,
      latestVersion: "1.0.0",
      publishedAt: 500,
    };
    expect(isCacheStale({ cache: old })).toBe(true);
  });

  it("returns false when cache is fresh", () => {
    const fresh = {
      lastChecked: Date.now() - 1000,
      latestVersion: "1.0.0",
      publishedAt: 500,
    };
    expect(isCacheStale({ cache: fresh })).toBe(false);
  });

  it("respects custom max age", () => {
    const cache = {
      lastChecked: Date.now() - 5000,
      latestVersion: "1.0.0",
      publishedAt: 500,
    };
    expect(isCacheStale({ cache, maxAgeMs: 3000 })).toBe(true);
    expect(isCacheStale({ cache, maxAgeMs: 10_000 })).toBe(false);
  });
});
