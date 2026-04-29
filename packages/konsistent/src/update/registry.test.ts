import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fetchLatestVersion, findLatestInChannel } from "./registry.js";

describe("findLatestInChannel", () => {
  it("finds latest stable version", () => {
    const versions = ["1.0.0", "1.1.0", "1.2.0", "2.0.0-beta.1"];
    expect(findLatestInChannel({ versions, channel: null })).toBe("1.2.0");
  });

  it("finds latest alpha version", () => {
    const versions = [
      "0.0.1-alpha.1",
      "0.0.1-alpha.4",
      "0.0.1-alpha.2",
      "0.0.1-beta.1",
      "1.0.0",
    ];
    expect(findLatestInChannel({ versions, channel: "alpha" })).toBe(
      "0.0.1-alpha.4"
    );
  });

  it("finds latest beta version", () => {
    const versions = ["1.0.0-beta.1", "1.0.0-beta.3", "1.0.0-alpha.5", "1.0.0"];
    expect(findLatestInChannel({ versions, channel: "beta" })).toBe(
      "1.0.0-beta.3"
    );
  });

  it("returns null when no versions match channel", () => {
    const versions = ["1.0.0", "2.0.0"];
    expect(findLatestInChannel({ versions, channel: "alpha" })).toBeNull();
  });

  it("returns null for empty versions", () => {
    expect(findLatestInChannel({ versions: [], channel: null })).toBeNull();
  });

  it("skips unparseable versions", () => {
    const versions = ["invalid", "1.0.0", "also-bad"];
    expect(findLatestInChannel({ versions, channel: null })).toBe("1.0.0");
  });

  it("compares across patch and minor versions", () => {
    const versions = ["0.0.1-alpha.10", "0.0.2-alpha.1", "0.1.0-alpha.1"];
    expect(findLatestInChannel({ versions, channel: "alpha" })).toBe(
      "0.1.0-alpha.1"
    );
  });
});

describe("fetchLatestVersion", () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("returns latest version from registry", async () => {
    const mockResponse = {
      ok: true,
      json: async () => ({
        versions: {
          "0.0.1-alpha.1": {},
          "0.0.1-alpha.2": {},
          "0.0.1-alpha.4": {},
        },
      }),
    };
    vi.mocked(globalThis.fetch).mockResolvedValue(
      mockResponse as unknown as Response
    );

    const result = await fetchLatestVersion({
      packageName: "konsistent",
      currentVersion: "0.0.1-alpha.1",
    });
    expect(result).toBe("0.0.1-alpha.4");
  });

  it("filters by prerelease channel", async () => {
    const mockResponse = {
      ok: true,
      json: async () => ({
        versions: {
          "0.0.1-alpha.5": {},
          "0.0.1-beta.1": {},
          "1.0.0": {},
        },
      }),
    };
    vi.mocked(globalThis.fetch).mockResolvedValue(
      mockResponse as unknown as Response
    );

    expect(
      await fetchLatestVersion({
        packageName: "konsistent",
        currentVersion: "0.0.1-alpha.1",
      })
    ).toBe("0.0.1-alpha.5");

    expect(
      await fetchLatestVersion({
        packageName: "konsistent",
        currentVersion: "0.0.1-beta.1",
      })
    ).toBe("0.0.1-beta.1");

    expect(
      await fetchLatestVersion({
        packageName: "konsistent",
        currentVersion: "0.9.0",
      })
    ).toBe("1.0.0");
  });

  it("returns null on network error", async () => {
    vi.mocked(globalThis.fetch).mockRejectedValue(new Error("network error"));

    const result = await fetchLatestVersion({
      packageName: "konsistent",
      currentVersion: "1.0.0",
    });
    expect(result).toBeNull();
  });

  it("returns null on non-ok response", async () => {
    vi.mocked(globalThis.fetch).mockResolvedValue({
      ok: false,
    } as unknown as Response);

    const result = await fetchLatestVersion({
      packageName: "konsistent",
      currentVersion: "1.0.0",
    });
    expect(result).toBeNull();
  });

  it("sends correct headers", async () => {
    vi.mocked(globalThis.fetch).mockResolvedValue({
      ok: true,
      json: async () => ({ versions: {} }),
    } as unknown as Response);

    await fetchLatestVersion({
      packageName: "konsistent",
      currentVersion: "1.0.0",
    });

    expect(globalThis.fetch).toHaveBeenCalledWith(
      "https://registry.npmjs.org/konsistent",
      expect.objectContaining({
        headers: { Accept: "application/vnd.npm.install-v1+json" },
      })
    );
  });
});
