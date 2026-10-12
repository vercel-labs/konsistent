import { execFile as execFileCb } from "node:child_process";
import { resolve } from "node:path";
import { promisify } from "node:util";
import { describe, expect, it } from "vitest";

const execFile = promisify(execFileCb);

const cliBinary = resolve(
  import.meta.dirname,
  "../packages/konsistent/dist/cli.js"
);

const fixturesDir = resolve(import.meta.dirname, "fixtures");

function runCli(opts: { cwd: string; configFile?: string }) {
  const args = ["check"];
  if (opts.configFile) {
    args.push("--config-path", resolve(opts.cwd, opts.configFile));
  }
  return execFile("node", [cliBinary, ...args], {
    cwd: opts.cwd,
    env: { ...process.env, GITHUB_ACTIONS: "" },
  });
}

async function expectCheckFails(opts: {
  cwd: string;
  configFile: string;
  stdoutIncludes: string[];
}) {
  try {
    await runCli({ configFile: opts.configFile, cwd: opts.cwd });
    expect.fail("Expected check to exit with code 1");
  } catch (err: unknown) {
    const error = err as {
      stdout: string;
      code: number | null;
      status: number;
    };
    expect(error.code ?? error.status).toBe(1);
    for (const expected of opts.stdoutIncludes) {
      expect(error.stdout).toContain(expected);
    }
  }
}

describe("mustNot reverse configs", () => {
  it("fails when file and export predicates are present", async () => {
    await expectCheckFails({
      configFile: "konsistent-reverse.json",
      cwd: resolve(fixturesDir, "plugin-system"),
      stdoutIncludes: [
        'Forbidden path type "directory"',
        'Forbidden constant export "pluginId"',
      ],
    });
  });

  it("fails when export and import predicates are present", async () => {
    await expectCheckFails({
      configFile: "konsistent-reverse.json",
      cwd: resolve(fixturesDir, "ai-toolkit"),
      stdoutIncludes: [
        'Forbidden export "openai"',
        'Forbidden type import "ProviderV1"',
      ],
    });
  });

  it("fails for present local declarations and passes for exported ones", async () => {
    await expectCheckFails({
      configFile: "konsistent-reverse.json",
      cwd: resolve(fixturesDir, "declaration-predicates"),
      stdoutIncludes: [
        'Forbidden type declaration "LocalType"',
        'Forbidden function declaration "createLocal"',
      ],
    });
    await expect(
      runCli({
        configFile: "konsistent-reverse.json",
        cwd: resolve(fixturesDir, "declaration-predicates-broken"),
      })
    ).resolves.not.toThrow();
  });

  it("fails for matching declaration order and passes for broken order", async () => {
    await expectCheckFails({
      configFile: "konsistent-reverse.json",
      cwd: resolve(fixturesDir, "declaration-order"),
      stdoutIncludes: [
        'Forbidden declaration order "alpha", "Beta", "gamma", "missing"',
      ],
    });
    await expect(
      runCli({
        configFile: "konsistent-reverse.json",
        cwd: resolve(fixturesDir, "declaration-order-broken"),
      })
    ).resolves.not.toThrow();
  });

  it("fails for present import source groups and passes when they are absent", async () => {
    await expectCheckFails({
      configFile: "konsistent-reverse.json",
      cwd: resolve(fixturesDir, "import-source-groups"),
      stdoutIncludes: [
        "Forbidden import from current directory",
        "Forbidden import from parent directories",
        "Forbidden import from external packages",
        "Forbidden type import from current directory",
        "Forbidden type import from parent directories",
        "Forbidden type import from external packages",
      ],
    });
    await expect(
      runCli({
        configFile: "konsistent-reverse.json",
        cwd: resolve(fixturesDir, "import-source-groups-broken"),
      })
    ).resolves.not.toThrow();
  });

  it("fails for pure barrels and passes for non-barrels", async () => {
    await expectCheckFails({
      configFile: "konsistent-reverse.json",
      cwd: resolve(fixturesDir, "barrel-files"),
      stdoutIncludes: ["Forbidden barrel file"],
    });
    await expect(
      runCli({
        configFile: "konsistent-reverse.json",
        cwd: resolve(fixturesDir, "barrel-files-broken"),
      })
    ).resolves.not.toThrow();
  });
});
