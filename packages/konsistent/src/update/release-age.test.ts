import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { isReleaseOldEnough, readMinimumReleaseAgeMs } from "./release-age.js";

const DAY_MS = 24 * 60 * 60 * 1000;
const latestVersion = "1.0.0-beta.14";
let directory: string;

beforeEach(() => {
  directory = fs.mkdtempSync(path.join(os.tmpdir(), "konsistent-release-age-"));
  fs.writeFileSync(
    path.join(directory, "package.json"),
    '{"packageManager":"pnpm@11.28.0"}'
  );
});

afterEach(() => {
  vi.restoreAllMocks();
  fs.rmSync(directory, { force: true, recursive: true });
});

function readAgeMs(cwd = directory) {
  return readMinimumReleaseAgeMs({ cwd, latestVersion });
}

describe("readMinimumReleaseAgeMs", () => {
  it("returns null without a policy", () => {
    expect(readAgeMs()).toBeNull();
  });

  it.each([0, 1, 2, 7])("reads a PNPM age of %i days", (days) => {
    fs.writeFileSync(
      path.join(directory, "pnpm-workspace.yaml"),
      `minimumReleaseAge: ${days * 1440}\n`
    );
    expect(readAgeMs()).toBe(days * DAY_MS);
  });

  it.each([0, 1, 2, 7])("reads a Bun age of %i days", (days) => {
    fs.writeFileSync(path.join(directory, "bun.lock"), "");
    fs.writeFileSync(
      path.join(directory, "bunfig.toml"),
      `[install]\nminimumReleaseAge = ${days * 86_400}\n`
    );
    expect(readAgeMs()).toBe(days * DAY_MS);
  });

  it.each([
    "konsistent",
    "kons*",
    "*",
    "konsistent@1.0.0-beta.14",
    "konsistent@1.0.0-beta.13 || v1.0.0-beta.14",
    "!another-package",
  ])("respects PNPM exclusion %s", (exclusion) => {
    fs.writeFileSync(
      path.join(directory, "pnpm-workspace.yaml"),
      `minimumReleaseAge: 10080\nminimumReleaseAgeExclude: [${JSON.stringify(exclusion)}]\n`
    );
    expect(readAgeMs()).toBe(0);
  });

  it.each([
    "other",
    "@konsistent/*",
    "konsistent@1.0.0-beta.13",
    "kons?stent",
    "!konsistent",
  ])("does not exempt PNPM exclusion %s", (exclusion) => {
    fs.writeFileSync(
      path.join(directory, "pnpm-workspace.yaml"),
      `minimumReleaseAge: 2880\nminimumReleaseAgeExclude: [${JSON.stringify(exclusion)}]\n`
    );
    expect(readAgeMs()).toBe(2 * DAY_MS);
  });

  it("supports scalar PNPM exclusions without an age", () => {
    fs.writeFileSync(
      path.join(directory, "pnpm-workspace.yaml"),
      "minimumReleaseAgeExclude: konsistent\n"
    );
    expect(readAgeMs()).toBe(0);
  });

  it("lets an unversioned PNPM exclusion override version-specific exclusions", () => {
    fs.writeFileSync(
      path.join(directory, "pnpm-workspace.yaml"),
      "minimumReleaseAge: 2880\nminimumReleaseAgeExclude: ['konsistent@1.0.0-beta.13', 'konsistent']\n"
    );
    expect(readAgeMs()).toBe(0);
  });

  it.each([
    { exclusion: "konsistent", expected: 0 },
    { exclusion: "kons*", expected: DAY_MS },
    { exclusion: "konsistent@1.0.0-beta.14", expected: DAY_MS },
  ])(
    "uses exact Bun exclusion matching for $exclusion",
    ({ exclusion, expected }) => {
      fs.writeFileSync(path.join(directory, "bun.lock"), "");
      fs.writeFileSync(
        path.join(directory, "bunfig.toml"),
        `[install]\nminimumReleaseAge = 86400\nminimumReleaseAgeExcludes = [${JSON.stringify(exclusion)}]\n`
      );
      expect(readAgeMs()).toBe(expected);
    }
  );

  it("supports Bun exclusions without an age", () => {
    fs.writeFileSync(path.join(directory, "bun.lock"), "");
    fs.writeFileSync(
      path.join(directory, "bunfig.toml"),
      '[install]\nminimumReleaseAgeExcludes = ["konsistent"]\n'
    );
    expect(readAgeMs()).toBe(0);
  });

  it.each([
    "",
    "{}",
    "[]",
    "minimumReleaseAge: [",
    "minimumReleaseAge: -1",
    'minimumReleaseAge: "2880"',
    "minimumReleaseAge: .inf",
    "minimumReleaseAge: .nan",
    "minimumReleaseAge: 1e308",
    "minimumReleaseAge: null",
    "minimumReleaseAge: 2880\nminimumReleaseAgeExclude: 12",
    "minimumReleaseAge: 2880\nminimumReleaseAgeExclude: null",
    "minimumReleaseAge: 2880\nminimumReleaseAgeExclude: [konsistent, 12]",
    "minimumReleaseAge: -1\nminimumReleaseAgeExclude: [konsistent]",
    "minimumReleaseAge: 2880\nminimumReleaseAgeExclude: [konsistent, 'other@^1.0.0']",
    "minimumReleaseAge: 2880\nminimumReleaseAgeExclude: ['kons*@1.0.0']",
    "minimumReleaseAge: 2880\nminimumReleaseAge: 1440",
    "minimumReleaseAge: 2880\n---\nminimumReleaseAge: 1440",
  ])("ignores missing or invalid PNPM policy: %s", (raw) => {
    fs.writeFileSync(path.join(directory, "pnpm-workspace.yaml"), raw);
    expect(readAgeMs()).toBeNull();
  });

  it.each([
    "",
    "install = 3",
    "[install]\nminimumReleaseAge = [",
    "[install]\nminimumReleaseAge = -1",
    '[install]\nminimumReleaseAge = "86400"',
    "[install]\nminimumReleaseAge = inf",
    "[install]\nminimumReleaseAge = nan",
    "[install]\nminimumReleaseAge = 1e308",
    '[install]\nminimumReleaseAge = 86400\nminimumReleaseAgeExcludes = "konsistent"',
    '[install]\nminimumReleaseAge = -1\nminimumReleaseAgeExcludes = ["konsistent"]',
  ])("ignores missing or invalid Bun policy: %s", (raw) => {
    fs.writeFileSync(path.join(directory, "bun.lock"), "");
    fs.writeFileSync(path.join(directory, "bunfig.toml"), raw);
    expect(readAgeMs()).toBeNull();
  });

  it("supports fractional ages and unrelated configuration", () => {
    fs.writeFileSync(
      path.join(directory, "pnpm-workspace.yaml"),
      "packages: ['packages/*']\nminimumReleaseAge: 0.5\n"
    );
    expect(readAgeMs()).toBe(30_000);
  });

  it.each(["pnpm", "bun"])(
    "does not search parent directories for %s policy",
    (manager) => {
      const nested = path.join(directory, "packages", "app");
      fs.mkdirSync(nested, { recursive: true });
      fs.writeFileSync(
        path.join(nested, "package.json"),
        JSON.stringify({ packageManager: `${manager}@1.0.0` })
      );
      fs.writeFileSync(
        path.join(directory, "pnpm-workspace.yaml"),
        "minimumReleaseAge: 2880\n"
      );
      fs.writeFileSync(
        path.join(directory, "bunfig.toml"),
        "[install]\nminimumReleaseAge = 172800\n"
      );
      expect(readAgeMs(nested)).toBeNull();
    }
  );

  it.each(["minimumReleaseAge: 1440", "minimumReleaseAge: [", "packages: []"])(
    "reads only the current-directory config: %s",
    (raw) => {
      const nested = path.join(directory, "nested");
      fs.mkdirSync(nested);
      fs.writeFileSync(
        path.join(nested, "package.json"),
        '{"packageManager":"pnpm@11.28.0"}'
      );
      fs.writeFileSync(
        path.join(directory, "pnpm-workspace.yaml"),
        "minimumReleaseAge: 10080\n"
      );
      fs.writeFileSync(path.join(nested, "pnpm-workspace.yaml"), raw);
      expect(readAgeMs(nested)).toBe(raw.includes("1440") ? DAY_MS : null);
    }
  );

  it("uses the npm fallback when both configs exist without a detected manager", () => {
    fs.writeFileSync(path.join(directory, "package.json"), "{}");
    fs.writeFileSync(
      path.join(directory, "pnpm-workspace.yaml"),
      "minimumReleaseAge: 2880\n"
    );
    fs.writeFileSync(
      path.join(directory, "bunfig.toml"),
      "[install]\nminimumReleaseAge = 86400\n"
    );
    expect(readAgeMs()).toBeNull();
  });

  it.each([
    { expected: 2 * DAY_MS, manager: "pnpm" },
    { expected: DAY_MS, manager: "bun" },
    { expected: null, manager: "npm" },
    { expected: null, manager: "yarn" },
  ])("uses declared $manager policy only", ({ manager, expected }) => {
    fs.writeFileSync(
      path.join(directory, "package.json"),
      JSON.stringify({ packageManager: `${manager}@1.0.0` })
    );
    fs.writeFileSync(
      path.join(directory, "pnpm-workspace.yaml"),
      "minimumReleaseAge: 2880\n"
    );
    fs.writeFileSync(
      path.join(directory, "bunfig.toml"),
      "[install]\nminimumReleaseAge = 86400\n"
    );
    expect(readAgeMs()).toBe(expected);
  });

  it.each([
    {
      filename: "pnpm-workspace.yaml",
      raw: "minimumReleaseAge: 2880\n",
    },
    {
      filename: "bunfig.toml",
      raw: "[install]\nminimumReleaseAge = 86400\n",
    },
  ])(
    "ignores $filename when the existing detector selects npm",
    ({ filename, raw }) => {
      fs.writeFileSync(path.join(directory, "package-lock.json"), "{}");
      fs.writeFileSync(path.join(directory, filename), raw);
      expect(readAgeMs()).toBeNull();
    }
  );

  it("treats unreadable config as unavailable", () => {
    fs.writeFileSync(path.join(directory, "pnpm-lock.yaml"), "");
    fs.writeFileSync(
      path.join(directory, "pnpm-workspace.yaml"),
      "minimumReleaseAge: 2880\n"
    );
    vi.spyOn(fs, "readFileSync").mockImplementation(() => {
      throw new Error("EACCES");
    });
    expect(readAgeMs()).toBeNull();
  });
});

describe("isReleaseOldEnough", () => {
  it.each([
    { age: DAY_MS - 1, expected: false },
    { age: DAY_MS, expected: true },
    { age: DAY_MS + 1, expected: true },
    { age: -1, expected: false },
  ])("checks release age $age", ({ age, expected }) => {
    expect(
      isReleaseOldEnough({
        minimumReleaseAgeMs: DAY_MS,
        now: 10 * DAY_MS,
        publishedAt: 10 * DAY_MS - age,
      })
    ).toBe(expected);
  });

  it("allows missing timestamps only when no age applies", () => {
    expect(
      isReleaseOldEnough({ minimumReleaseAgeMs: 0, publishedAt: null })
    ).toBe(true);
    expect(
      isReleaseOldEnough({ minimumReleaseAgeMs: DAY_MS, publishedAt: null })
    ).toBe(false);
    expect(
      isReleaseOldEnough({
        minimumReleaseAgeMs: DAY_MS,
        publishedAt: Number.NaN,
      })
    ).toBe(false);
  });

  it("uses the current time by default", () => {
    vi.spyOn(Date, "now").mockReturnValue(10 * DAY_MS);
    expect(
      isReleaseOldEnough({
        minimumReleaseAgeMs: DAY_MS,
        publishedAt: 9 * DAY_MS,
      })
    ).toBe(true);
  });
});
