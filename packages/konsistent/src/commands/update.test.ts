import { runCommand } from "citty";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fetchLatestRelease } from "../update/registry.js";
import { readMinimumReleaseAgeMs } from "../update/release-age.js";
import { runUpdate } from "../update/run-update.js";
import updateCommand from "./update.js";

vi.mock("../update/registry.js", () => ({ fetchLatestRelease: vi.fn() }));
vi.mock("../update/release-age.js", async () => ({
  ...(await vi.importActual("../update/release-age.js")),
  readMinimumReleaseAgeMs: vi.fn(),
}));
vi.mock("../update/run-update.js", () => ({ runUpdate: vi.fn() }));
vi.mock("../version.js", () => ({ getVersion: () => "1.0.0-beta.12" }));

const DAY_MS = 86_400_000;
const now = 10 * DAY_MS;
const originalExitCode = process.exitCode;

beforeEach(() => {
  vi.resetAllMocks();
  vi.spyOn(Date, "now").mockReturnValue(now);
  vi.spyOn(console, "error").mockImplementation(vi.fn());
  vi.spyOn(console, "warn").mockImplementation(vi.fn());
  vi.mocked(readMinimumReleaseAgeMs).mockReturnValue(null);
  vi.mocked(fetchLatestRelease).mockResolvedValue({
    publishedAt: now - DAY_MS,
    version: "1.0.0-beta.14",
  });
});

afterEach(() => {
  vi.restoreAllMocks();
  process.exitCode = originalExitCode;
});

describe("update command", () => {
  it("defines metadata and arguments", () => {
    expect(updateCommand).toMatchObject({
      args: {},
      meta: { name: "update" },
    });
  });

  it("updates a recent release without an explicit policy", async () => {
    await runCommand(updateCommand, { rawArgs: [] });
    expect(runUpdate).toHaveBeenCalledWith({
      currentVersion: "1.0.0-beta.12",
      latestVersion: "1.0.0-beta.14",
    });
    expect(console.warn).not.toHaveBeenCalled();
  });

  it("rejects a release younger than the repository policy", async () => {
    vi.mocked(readMinimumReleaseAgeMs).mockReturnValue(2 * DAY_MS);
    await runCommand(updateCommand, { rawArgs: [] });
    expect(process.exitCode).toBe(1);
    expect(runUpdate).not.toHaveBeenCalled();
    expect(console.error).toHaveBeenCalledWith(
      expect.stringContaining(new Date(now + DAY_MS).toISOString())
    );
    expect(console.error).toHaveBeenCalledWith(
      expect.stringContaining("minimum release age")
    );
    expect(console.error).not.toHaveBeenCalledWith(
      expect.stringContaining("already up to date")
    );
  });

  it.each([0, DAY_MS])("updates when policy %i allows it", async (policy) => {
    vi.mocked(readMinimumReleaseAgeMs).mockReturnValue(policy);
    await runCommand(updateCommand, { rawArgs: [] });
    expect(runUpdate).toHaveBeenCalledOnce();
  });

  it.each([null, 0, DAY_MS, 7 * DAY_MS])(
    "does not require a publication time for policy %j",
    async (policy) => {
      vi.mocked(readMinimumReleaseAgeMs).mockReturnValue(policy);
      vi.mocked(fetchLatestRelease).mockResolvedValue({
        publishedAt: null,
        version: "1.0.0-beta.14",
      });
      await runCommand(updateCommand, { rawArgs: [] });
      expect(process.exitCode).toBe(originalExitCode);
      expect(runUpdate).toHaveBeenCalledOnce();
      expect(console.warn).toHaveBeenCalledExactlyOnceWith(
        "Warning: Could not verify the publication time of konsistent v1.0.0-beta.14. Proceeding without checking its minimum release age."
      );
      expect(console.error).not.toHaveBeenCalledWith(
        expect.stringContaining("update was not attempted")
      );
    }
  );

  it("preserves the already-up-to-date response", async () => {
    vi.mocked(fetchLatestRelease).mockResolvedValue({
      publishedAt: null,
      version: "1.0.0-beta.12",
    });
    await runCommand(updateCommand, { rawArgs: [] });
    expect(runUpdate).not.toHaveBeenCalled();
    expect(readMinimumReleaseAgeMs).not.toHaveBeenCalled();
    expect(console.error).toHaveBeenCalledWith(
      expect.stringContaining("already up to date")
    );
  });

  it("preserves failure when registry lookup fails", async () => {
    vi.mocked(fetchLatestRelease).mockResolvedValue(null);
    vi.spyOn(process, "exit").mockImplementation(() => {
      throw new Error("exit");
    });
    await expect(runCommand(updateCommand, { rawArgs: [] })).rejects.toThrow(
      "exit"
    );
    expect(process.exit).toHaveBeenCalledWith(1);
    expect(runUpdate).not.toHaveBeenCalled();
  });
});
