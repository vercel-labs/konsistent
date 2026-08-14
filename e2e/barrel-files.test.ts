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

function runCli(opts: {
  args?: string[];
  cwd?: string;
  env?: Record<string, string>;
}) {
  return execFile("node", [cliBinary, ...(opts.args ?? [])], {
    cwd: opts.cwd,
    env: { ...process.env, GITHUB_ACTIONS: "", ...opts.env },
  });
}

describe("barrel-files fixture", () => {
  const cwd = resolve(fixturesDir, "barrel-files");

  it("konsistent check exits 0 when the index file only re-exports", async () => {
    await expect(runCli({ args: ["check"], cwd })).resolves.not.toThrow();
  });

  it("konsistent validate accepts the areBarrelFiles predicate", async () => {
    const { stdout } = await runCli({ args: ["validate"], cwd });
    expect(stdout).toContain("Configuration is valid");
  });
});

describe("barrel-files-broken fixture", () => {
  const cwd = resolve(fixturesDir, "barrel-files-broken");

  it("konsistent check exits 1 when the index file declares a constant", async () => {
    try {
      await runCli({ args: ["check"], cwd });
      expect.fail("Expected check to exit with code 1");
    } catch (err: unknown) {
      const error = err as {
        stdout: string;
        stderr: string;
        code: number;
        status: number;
      };
      expect(error.code ?? error.status).toBe(1);
      expect(error.stdout).toContain(
        "Barrel file must not contain declarations"
      );
      expect(error.stdout).toContain("barrels-must-be-pure");
    }
  });
});
