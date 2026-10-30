import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  getPrereleaseChannel,
  parseVersion,
} from "../packages/konsistent/src/update/semver.js";
import { getVersion } from "../packages/konsistent/src/version.js";

const cli = path.resolve(
  import.meta.dirname,
  "../packages/konsistent/dist/cli.js"
);
const preload = path.resolve(import.meta.dirname, "helpers/update-preload.mjs");
const fixtures = path.resolve(
  import.meta.dirname,
  "fixtures/update-release-age"
);
const DAY_MS = 86_400_000;
const now = Date.parse("2030-01-10T12:00:00.000Z");
const currentVersion = getVersion();
const parsed = parseVersion(currentVersion);
if (!parsed) {
  throw new Error(`Unsupported CLI version: ${currentVersion}`);
}
const channel = getPrereleaseChannel(currentVersion);
const nextBase = `${parsed.major}.${parsed.minor}.${parsed.patch + 1}`;
const olderVersion = channel ? `${nextBase}-${channel}.1` : nextBase;
const latestVersion = channel
  ? `${nextBase}-${channel}.2`
  : `${parsed.major}.${parsed.minor}.${parsed.patch + 2}`;
let directory: string;
let cacheDirectory: string;

beforeEach(() => {
  directory = fs.mkdtempSync(path.join(os.tmpdir(), "konsistent-update-e2e-"));
  cacheDirectory = path.join(directory, "cache");
});

afterEach(() => {
  fs.rmSync(directory, { force: true, recursive: true });
});

function copyFixture(fixture: string): string {
  const destination = path.join(directory, fixture);
  fs.cpSync(path.join(fixtures, fixture), destination, { recursive: true });
  return destination;
}

function runCli(opts: {
  cwd: string;
  command?: "update" | "version";
  publishedAt?: number | null;
}): Promise<{ code: number | null; stdout: string; stderr: string }> {
  const publishedAt =
    opts.publishedAt === undefined ? now - DAY_MS : opts.publishedAt;
  const time: Record<string, string> = {
    [currentVersion]: new Date(now - 60 * DAY_MS).toISOString(),
    [olderVersion]: new Date(now - 30 * DAY_MS).toISOString(),
  };
  if (publishedAt !== null) {
    time[latestVersion] = new Date(publishedAt).toISOString();
  }
  const metadata = {
    time,
    versions: { [currentVersion]: {}, [olderVersion]: {}, [latestVersion]: {} },
  };
  return new Promise((resolve, reject) => {
    const child = spawn(
      process.execPath,
      ["--import", preload, cli, opts.command ?? "version"],
      {
        cwd: opts.cwd,
        env: {
          ...process.env,
          CI: "",
          FORCE_COLOR: "0",
          KONSISTENT_NO_UPDATE_CHECK: "",
          KONSISTENT_TEST_UPDATE: JSON.stringify({
            metadata,
            now,
          }),
          NO_COLOR: "1",
          XDG_CONFIG_HOME: cacheDirectory,
        },
        timeout: 10_000,
      }
    );
    let stdout = "";
    let stderr = "";
    let answered = false;
    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
      if (!answered && stderr.includes("Would you like to update now?")) {
        answered = true;
        child.stdin.end("n\n");
      }
    });
    child.on("error", reject);
    child.on("close", (code) => resolve({ code, stderr, stdout }));
  });
}

describe("update minimum release age", () => {
  it("suppresses recent-release notices but allows explicit updates by default", async () => {
    const cwd = copyFixture("none");
    const notice = await runCli({ cwd });
    expect(notice.code, notice.stderr).toBe(0);
    expect(notice.stdout.trim()).toBe(currentVersion);
    expect(notice.stderr).not.toContain("Update available");
    const update = await runCli({ command: "update", cwd });
    expect(update.code, update.stderr).toBe(0);
    expect(update.stderr).toContain("[test-install]");
    expect(update.stderr).toContain(latestVersion);
  });

  it("blocks a release younger than the PNPM policy without attempting installation", async () => {
    const cwd = copyFixture("pnpm");
    const before = fs.readFileSync(path.join(cwd, "package.json"), "utf-8");
    const notice = await runCli({ cwd });
    expect(notice.code, notice.stderr).toBe(0);
    expect(notice.stderr).not.toContain("Update available");
    expect(notice.stderr).not.toContain("Would you like");
    const update = await runCli({ command: "update", cwd });
    expect(update.code, update.stderr).toBe(1);
    expect(update.stderr).toContain("minimum release age");
    expect(update.stderr).toContain(latestVersion);
    expect(update.stderr).toContain(new Date(now + DAY_MS).toISOString());
    expect(update.stderr).not.toContain("[test-install]");
    expect(update.stderr).not.toContain(olderVersion);
    expect(fs.readFileSync(path.join(cwd, "package.json"), "utf-8")).toBe(
      before
    );
  });

  it("warns but allows an explicit update with an unknown timestamp under a Bun policy", async () => {
    const cwd = copyFixture("bun");
    const notice = await runCli({ cwd, publishedAt: null });
    expect(notice.code, notice.stderr).toBe(0);
    expect(notice.stderr).not.toContain("Update available");
    const update = await runCli({ command: "update", cwd, publishedAt: null });
    expect(update.code, update.stderr).toBe(0);
    expect(update.stderr).toContain("[test-install]");
    expect(update.stderr).toContain(latestVersion);
    expect(update.stderr).not.toContain("Update was not attempted");
    expect(update.stderr).toContain(
      `Warning: Could not verify the publication time of konsistent v${latestVersion}. Proceeding without checking its minimum release age.`
    );
  });
});
