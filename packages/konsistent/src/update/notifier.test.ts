import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as cache from "./cache.js";
import {
  checkAndPrompt,
  formatNotification,
  shouldCheckForUpdate,
} from "./notifier.js";
import * as prompt from "./prompt.js";
import * as registry from "./registry.js";
import * as releaseAge from "./release-age.js";
import * as runUpdateMod from "./run-update.js";

vi.mock("./cache.js", async () => {
  const actual = await vi.importActual<typeof cache>("./cache.js");
  return {
    ...actual,
    isCacheStale: vi.fn(),
    readCache: vi.fn(),
    writeCache: vi.fn(),
  };
});

vi.mock("./registry.js", () => ({
  fetchLatestRelease: vi.fn(),
}));

vi.mock("./release-age.js", async () => ({
  ...(await vi.importActual<typeof releaseAge>("./release-age.js")),
  readMinimumReleaseAgeMs: vi.fn(),
}));

vi.mock("./prompt.js", () => ({
  promptYesNo: vi.fn(),
}));

vi.mock("./run-update.js", async () => {
  const actual = await vi.importActual<typeof runUpdateMod>("./run-update.js");
  return {
    ...actual,
    canAutoUpdate: vi.fn(),
    runUpdate: vi.fn(),
  };
});

describe("shouldCheckForUpdate", () => {
  const originalEnv = { ...process.env };
  const originalIsTTY = process.stdin.isTTY;

  afterEach(() => {
    process.env = { ...originalEnv };
    Object.defineProperty(process.stdin, "isTTY", {
      value: originalIsTTY,
      writable: true,
    });
  });

  it("returns false for update command", () => {
    Object.defineProperty(process.stdin, "isTTY", {
      value: true,
      writable: true,
    });
    expect(shouldCheckForUpdate("update")).toBe(false);
  });

  it("returns false when CI is set", () => {
    Object.defineProperty(process.stdin, "isTTY", {
      value: true,
      writable: true,
    });
    process.env.CI = "true";
    expect(shouldCheckForUpdate("check")).toBe(false);
  });

  it("returns false when KONSISTENT_NO_UPDATE_CHECK is set", () => {
    Object.defineProperty(process.stdin, "isTTY", {
      value: true,
      writable: true,
    });
    process.env.KONSISTENT_NO_UPDATE_CHECK = "1";
    expect(shouldCheckForUpdate("check")).toBe(false);
  });

  it("returns false when stdin is not a TTY", () => {
    Object.defineProperty(process.stdin, "isTTY", {
      value: false,
      writable: true,
    });
    process.env.CI = undefined;
    process.env.KONSISTENT_NO_UPDATE_CHECK = undefined;
    expect(shouldCheckForUpdate("check")).toBe(false);
  });

  it("returns true for normal interactive usage", () => {
    Object.defineProperty(process.stdin, "isTTY", {
      value: true,
      writable: true,
    });
    process.env.CI = undefined;
    process.env.KONSISTENT_NO_UPDATE_CHECK = undefined;
    expect(shouldCheckForUpdate("check")).toBe(true);
  });
});

describe("formatNotification", () => {
  it("includes both versions", () => {
    const result = formatNotification({
      currentVersion: "0.0.1-alpha.4",
      latestVersion: "0.0.1-alpha.5",
    });
    expect(result).toContain("0.0.1-alpha.4");
    expect(result).toContain("0.0.1-alpha.5");
    expect(result).toContain("konsistent");
  });
});

describe("checkAndPrompt", () => {
  const DAY_MS = 86_400_000;
  beforeEach(() => {
    vi.mocked(releaseAge.readMinimumReleaseAgeMs).mockReturnValue(null);
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.restoreAllMocks();
  });

  it("returns false when no newer version exists", async () => {
    vi.mocked(cache.isCacheStale).mockReturnValue(false);
    vi.mocked(cache.readCache).mockReturnValue({
      channel: "alpha",
      lastChecked: Date.now(),
      latestVersion: "0.0.1-alpha.4",
      publishedAt: 0,
    });

    const result = await checkAndPrompt({
      currentVersion: "0.0.1-alpha.4",
    });
    expect(result).toBe(false);
  });

  it("fetches from registry when cache is stale", async () => {
    vi.mocked(cache.isCacheStale).mockReturnValue(true);
    vi.mocked(registry.fetchLatestRelease).mockResolvedValue({
      publishedAt: 0,
      version: "0.0.1-alpha.5",
    });
    vi.mocked(runUpdateMod.canAutoUpdate).mockReturnValue({
      mode: "local",
      packageManager: "pnpm",
    });
    vi.mocked(prompt.promptYesNo).mockResolvedValue(false);

    const errorSpy = vi.spyOn(console, "error").mockImplementation(vi.fn());

    const result = await checkAndPrompt({
      currentVersion: "0.0.1-alpha.4",
    });

    expect(registry.fetchLatestRelease).toHaveBeenCalled();
    expect(cache.writeCache).toHaveBeenCalledWith(
      expect.objectContaining({ latestVersion: "0.0.1-alpha.5" })
    );
    expect(result).toBe(false);
    errorSpy.mockRestore();
  });

  it("returns true and runs update when user confirms", async () => {
    vi.mocked(cache.isCacheStale).mockReturnValue(false);
    vi.mocked(cache.readCache).mockReturnValue({
      channel: "alpha",
      lastChecked: Date.now(),
      latestVersion: "0.0.1-alpha.5",
      publishedAt: 0,
    });
    vi.mocked(runUpdateMod.canAutoUpdate).mockReturnValue({
      mode: "local",
      packageManager: "pnpm",
    });
    vi.mocked(prompt.promptYesNo).mockResolvedValue(true);

    const errorSpy = vi.spyOn(console, "error").mockImplementation(vi.fn());

    const result = await checkAndPrompt({
      currentVersion: "0.0.1-alpha.4",
    });

    expect(runUpdateMod.runUpdate).toHaveBeenCalledWith({
      currentVersion: "0.0.1-alpha.4",
      latestVersion: "0.0.1-alpha.5",
    });
    expect(result).toBe(true);
    errorSpy.mockRestore();
  });

  it("prints manual hint when canAutoUpdate returns null", async () => {
    vi.mocked(cache.isCacheStale).mockReturnValue(false);
    vi.mocked(cache.readCache).mockReturnValue({
      channel: "alpha",
      lastChecked: Date.now(),
      latestVersion: "0.0.1-alpha.5",
      publishedAt: 0,
    });
    vi.mocked(runUpdateMod.canAutoUpdate).mockReturnValue(null);

    const errorSpy = vi.spyOn(console, "error").mockImplementation(vi.fn());

    const result = await checkAndPrompt({
      currentVersion: "0.0.1-alpha.4",
    });

    expect(prompt.promptYesNo).not.toHaveBeenCalled();
    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining("Run the following command")
    );
    expect(result).toBe(false);
    errorSpy.mockRestore();
  });

  it("returns false when registry fetch fails", async () => {
    vi.mocked(cache.isCacheStale).mockReturnValue(true);
    vi.mocked(registry.fetchLatestRelease).mockResolvedValue(null);

    const result = await checkAndPrompt({
      currentVersion: "0.0.1-alpha.4",
    });
    expect(result).toBe(false);
  });

  it.each([
    { age: DAY_MS, expected: false, policy: null },
    { age: 2 * DAY_MS, expected: true, policy: null },
    { age: DAY_MS, expected: true, policy: DAY_MS },
    { age: 3 * DAY_MS, expected: false, policy: 7 * DAY_MS },
    { age: 0, expected: true, policy: 0 },
  ])(
    "checks cached age $age against policy $policy",
    async ({ age, policy, expected }) => {
      vi.mocked(cache.isCacheStale).mockReturnValue(false);
      vi.mocked(cache.readCache).mockReturnValue({
        channel: "alpha",
        lastChecked: Date.now(),
        latestVersion: "0.0.1-alpha.5",
        publishedAt: Date.now() - age,
      });
      vi.mocked(releaseAge.readMinimumReleaseAgeMs).mockReturnValue(policy);
      vi.mocked(runUpdateMod.canAutoUpdate).mockReturnValue({
        mode: "local",
        packageManager: "pnpm",
      });
      vi.mocked(prompt.promptYesNo).mockResolvedValue(false);
      const errorSpy = vi.spyOn(console, "error").mockImplementation(vi.fn());
      await checkAndPrompt({ currentVersion: "0.0.1-alpha.4" });
      expect(prompt.promptYesNo).toHaveBeenCalledTimes(expected ? 1 : 0);
      if (!expected) {
        expect(errorSpy).not.toHaveBeenCalled();
        expect(runUpdateMod.canAutoUpdate).not.toHaveBeenCalled();
      }
    }
  );

  it("rechecks a shared cached release against each repository policy", async () => {
    vi.mocked(cache.isCacheStale).mockReturnValue(false);
    vi.mocked(cache.readCache).mockReturnValue({
      channel: "alpha",
      lastChecked: Date.now(),
      latestVersion: "0.0.1-alpha.5",
      publishedAt: Date.now() - DAY_MS,
    });
    vi.mocked(releaseAge.readMinimumReleaseAgeMs)
      .mockReturnValueOnce(7 * DAY_MS)
      .mockReturnValueOnce(0);
    vi.mocked(runUpdateMod.canAutoUpdate).mockReturnValue({
      mode: "local",
      packageManager: "pnpm",
    });
    vi.mocked(prompt.promptYesNo).mockResolvedValue(false);
    vi.spyOn(console, "error").mockImplementation(vi.fn());
    await checkAndPrompt({ currentVersion: "0.0.1-alpha.4" });
    expect(prompt.promptYesNo).not.toHaveBeenCalled();
    await checkAndPrompt({ currentVersion: "0.0.1-alpha.4" });
    expect(prompt.promptYesNo).toHaveBeenCalledOnce();
    expect(registry.fetchLatestRelease).not.toHaveBeenCalled();
  });

  it("becomes eligible as time passes without refreshing metadata", async () => {
    const now = 10 * DAY_MS;
    vi.spyOn(Date, "now").mockReturnValue(now);
    vi.mocked(cache.isCacheStale).mockReturnValue(false);
    vi.mocked(cache.readCache).mockReturnValue({
      channel: "alpha",
      lastChecked: now,
      latestVersion: "0.0.1-alpha.5",
      publishedAt: now - 2 * DAY_MS + 1000,
    });
    vi.mocked(runUpdateMod.canAutoUpdate).mockReturnValue({
      mode: "local",
      packageManager: "pnpm",
    });
    vi.mocked(prompt.promptYesNo).mockResolvedValue(false);
    vi.spyOn(console, "error").mockImplementation(vi.fn());
    await checkAndPrompt({ currentVersion: "0.0.1-alpha.4" });
    expect(prompt.promptYesNo).not.toHaveBeenCalled();
    vi.spyOn(Date, "now").mockReturnValue(now + 1000);
    await checkAndPrompt({ currentVersion: "0.0.1-alpha.4" });
    expect(prompt.promptYesNo).toHaveBeenCalledOnce();
    expect(registry.fetchLatestRelease).not.toHaveBeenCalled();
  });

  it("refreshes metadata cached for a different channel", async () => {
    vi.mocked(cache.isCacheStale).mockReturnValue(false);
    vi.mocked(cache.readCache).mockReturnValue({
      channel: "beta",
      lastChecked: Date.now(),
      latestVersion: "2.0.0-beta.1",
      publishedAt: 0,
    });
    vi.mocked(registry.fetchLatestRelease).mockResolvedValue(null);
    await checkAndPrompt({ currentVersion: "0.0.1-alpha.4" });
    expect(registry.fetchLatestRelease).toHaveBeenCalledOnce();
    expect(prompt.promptYesNo).not.toHaveBeenCalled();
  });

  it("caches an ineligible latest release without announcing it", async () => {
    vi.mocked(cache.isCacheStale).mockReturnValue(true);
    const publishedAt = Date.now();
    vi.mocked(registry.fetchLatestRelease).mockResolvedValue({
      publishedAt,
      version: "0.0.1-alpha.5",
    });
    const errorSpy = vi.spyOn(console, "error").mockImplementation(vi.fn());
    await checkAndPrompt({ currentVersion: "0.0.1-alpha.4" });
    expect(cache.writeCache).toHaveBeenCalledWith(
      expect.objectContaining({
        channel: "alpha",
        latestVersion: "0.0.1-alpha.5",
        publishedAt,
      })
    );
    expect(errorSpy).not.toHaveBeenCalled();
  });

  it("suppresses notices when publication time is unknown", async () => {
    vi.mocked(cache.isCacheStale).mockReturnValue(false);
    vi.mocked(cache.readCache).mockReturnValue({
      channel: "alpha",
      lastChecked: Date.now(),
      latestVersion: "0.0.1-alpha.5",
      publishedAt: null,
    });
    const errorSpy = vi.spyOn(console, "error").mockImplementation(vi.fn());
    await checkAndPrompt({ currentVersion: "0.0.1-alpha.4" });
    expect(errorSpy).not.toHaveBeenCalled();
    expect(prompt.promptYesNo).not.toHaveBeenCalled();
  });
});
