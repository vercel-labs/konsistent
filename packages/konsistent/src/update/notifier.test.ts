import { afterEach, describe, expect, it, vi } from "vitest";
import * as cache from "./cache.js";
import {
  checkAndPrompt,
  formatNotification,
  shouldCheckForUpdate,
} from "./notifier.js";
import * as prompt from "./prompt.js";
import * as registry from "./registry.js";
import * as runUpdateMod from "./run-update.js";

vi.mock("./cache.js", async () => {
  const actual = await vi.importActual<typeof cache>("./cache.js");
  return {
    ...actual,
    readCache: vi.fn(),
    writeCache: vi.fn(),
    isCacheStale: vi.fn(),
  };
});

vi.mock("./registry.js", () => ({
  fetchLatestVersion: vi.fn(),
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
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns false when no newer version exists", async () => {
    vi.mocked(cache.isCacheStale).mockReturnValue(false);
    vi.mocked(cache.readCache).mockReturnValue({
      lastChecked: Date.now(),
      latestVersion: "0.0.1-alpha.4",
    });

    const result = await checkAndPrompt({
      currentVersion: "0.0.1-alpha.4",
    });
    expect(result).toBe(false);
  });

  it("fetches from registry when cache is stale", async () => {
    vi.mocked(cache.isCacheStale).mockReturnValue(true);
    vi.mocked(registry.fetchLatestVersion).mockResolvedValue("0.0.1-alpha.5");
    vi.mocked(runUpdateMod.canAutoUpdate).mockReturnValue({
      mode: "local",
      packageManager: "pnpm",
    });
    vi.mocked(prompt.promptYesNo).mockResolvedValue(false);

    const errorSpy = vi.spyOn(console, "error").mockImplementation(vi.fn());

    const result = await checkAndPrompt({
      currentVersion: "0.0.1-alpha.4",
    });

    expect(registry.fetchLatestVersion).toHaveBeenCalled();
    expect(cache.writeCache).toHaveBeenCalledWith(
      expect.objectContaining({ latestVersion: "0.0.1-alpha.5" })
    );
    expect(result).toBe(false);
    errorSpy.mockRestore();
  });

  it("returns true and runs update when user confirms", async () => {
    vi.mocked(cache.isCacheStale).mockReturnValue(false);
    vi.mocked(cache.readCache).mockReturnValue({
      lastChecked: Date.now(),
      latestVersion: "0.0.1-alpha.5",
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
      lastChecked: Date.now(),
      latestVersion: "0.0.1-alpha.5",
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
    vi.mocked(registry.fetchLatestVersion).mockResolvedValue(null);

    const result = await checkAndPrompt({
      currentVersion: "0.0.1-alpha.4",
    });
    expect(result).toBe(false);
  });
});
