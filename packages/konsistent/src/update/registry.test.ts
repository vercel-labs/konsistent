import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fetchLatestRelease, findLatestInChannel } from "./registry.js";

describe("findLatestInChannel", () => {
  it("finds latest stable version", () => {
    const versions = ["1.0.0", "1.1.0", "1.2.0", "2.0.0-beta.1"];
    expect(findLatestInChannel({ channel: null, versions })).toBe("1.2.0");
  });

  it("finds latest alpha version", () => {
    const versions = [
      "0.0.1-alpha.1",
      "0.0.1-alpha.4",
      "0.0.1-alpha.2",
      "0.0.1-beta.1",
      "1.0.0",
    ];
    expect(findLatestInChannel({ channel: "alpha", versions })).toBe(
      "0.0.1-alpha.4"
    );
  });

  it("finds latest beta version", () => {
    const versions = ["1.0.0-beta.1", "1.0.0-beta.3", "1.0.0-alpha.5", "1.0.0"];
    expect(findLatestInChannel({ channel: "beta", versions })).toBe(
      "1.0.0-beta.3"
    );
  });

  it("returns null when no versions match channel", () => {
    const versions = ["1.0.0", "2.0.0"];
    expect(findLatestInChannel({ channel: "alpha", versions })).toBeNull();
  });

  it("returns null for empty versions", () => {
    expect(findLatestInChannel({ channel: null, versions: [] })).toBeNull();
  });

  it("skips unparseable versions", () => {
    const versions = ["invalid", "1.0.0", "also-bad"];
    expect(findLatestInChannel({ channel: null, versions })).toBe("1.0.0");
  });

  it("compares across patch and minor versions", () => {
    const versions = ["0.0.1-alpha.10", "0.0.2-alpha.1", "0.1.0-alpha.1"];
    expect(findLatestInChannel({ channel: "alpha", versions })).toBe(
      "0.1.0-alpha.1"
    );
  });
});

describe("fetchLatestRelease", () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("returns latest version from registry", async () => {
    vi.mocked(globalThis.fetch).mockResolvedValue(
      Response.json({
        versions: {
          "0.0.1-alpha.1": {},
          "0.0.1-alpha.2": {},
          "0.0.1-alpha.4": {},
        },
      })
    );

    const result = await fetchLatestRelease({
      currentVersion: "0.0.1-alpha.1",
      packageName: "konsistent",
    });
    expect(result).toEqual({ publishedAt: null, version: "0.0.1-alpha.4" });
  });

  it("filters by prerelease channel", async () => {
    vi.mocked(globalThis.fetch).mockImplementation(() =>
      Promise.resolve(
        Response.json({
          versions: {
            "0.0.1-alpha.5": {},
            "0.0.1-beta.1": {},
            "1.0.0": {},
          },
        })
      )
    );

    expect(
      await fetchLatestRelease({
        currentVersion: "0.0.1-alpha.1",
        packageName: "konsistent",
      })
    ).toEqual({ publishedAt: null, version: "0.0.1-alpha.5" });

    expect(
      await fetchLatestRelease({
        currentVersion: "0.0.1-beta.1",
        packageName: "konsistent",
      })
    ).toEqual({ publishedAt: null, version: "0.0.1-beta.1" });

    expect(
      await fetchLatestRelease({
        currentVersion: "0.9.0",
        packageName: "konsistent",
      })
    ).toEqual({ publishedAt: null, version: "1.0.0" });
  });

  it("returns null on network error", async () => {
    vi.mocked(globalThis.fetch).mockRejectedValue(new Error("network error"));

    const result = await fetchLatestRelease({
      currentVersion: "1.0.0",
      packageName: "konsistent",
    });
    expect(result).toBeNull();
  });

  it("returns null on non-ok response", async () => {
    vi.mocked(globalThis.fetch).mockResolvedValue(
      new Response(null, { status: 500 })
    );

    const result = await fetchLatestRelease({
      currentVersion: "1.0.0",
      packageName: "konsistent",
    });
    expect(result).toBeNull();
  });

  it("sends correct headers", async () => {
    vi.mocked(globalThis.fetch).mockResolvedValue(
      Response.json({ versions: {} })
    );

    await fetchLatestRelease({
      currentVersion: "1.0.0",
      packageName: "konsistent",
    });

    expect(globalThis.fetch).toHaveBeenCalledWith(
      "https://registry.npmjs.org/konsistent",
      expect.objectContaining({
        headers: { Accept: "application/json" },
      })
    );
  });

  it("returns the latest publication time without selecting an older release", async () => {
    const timestamp = "2026-10-29T12:00:00.000Z";
    vi.mocked(globalThis.fetch).mockResolvedValue(
      Response.json({
        time: {
          "1.0.0-beta.13": "2026-09-01T12:00:00.000Z",
          "1.0.0-beta.14": timestamp,
        },
        versions: { "1.0.0-beta.13": {}, "1.0.0-beta.14": {} },
      })
    );
    expect(
      await fetchLatestRelease({
        currentVersion: "1.0.0-beta.12",
        packageName: "konsistent",
      })
    ).toEqual({ publishedAt: Date.parse(timestamp), version: "1.0.0-beta.14" });
  });

  it.each([null, "invalid", 123, {}])(
    "returns an unknown publication time for %j",
    async (timestamp) => {
      vi.mocked(globalThis.fetch).mockResolvedValue(
        Response.json({
          time: { "1.0.0": timestamp },
          versions: { "1.0.0": {} },
        })
      );
      expect(
        await fetchLatestRelease({
          currentVersion: "0.9.0",
          packageName: "konsistent",
        })
      ).toEqual({ publishedAt: null, version: "1.0.0" });
    }
  );

  it.each([null, {}, { versions: [] }, { versions: "bad" }, { versions: {} }])(
    "ignores invalid version metadata %j",
    async (metadata) => {
      vi.mocked(globalThis.fetch).mockResolvedValue(Response.json(metadata));
      expect(
        await fetchLatestRelease({
          currentVersion: "1.0.0",
          packageName: "konsistent",
        })
      ).toBeNull();
    }
  );

  it("returns null for invalid JSON", async () => {
    vi.mocked(globalThis.fetch).mockResolvedValue(new Response("not JSON"));
    expect(
      await fetchLatestRelease({
        currentVersion: "1.0.0",
        packageName: "konsistent",
      })
    ).toBeNull();
  });
});
