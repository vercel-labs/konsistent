import { execFile as execFileCb } from "node:child_process";
import { resolve } from "node:path";
import { promisify } from "node:util";
import { describe, expect, it } from "vitest";

const execFile = promisify(execFileCb);

const cliBinary = resolve(
  import.meta.dirname,
  "../packages/konsistent/dist/index.js"
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

describe("convention-placeholders fixture", () => {
  const cwd = resolve(fixturesDir, "convention-placeholders");

  it("konsistent check exits 0 when static placeholders feed must templates", async () => {
    await expect(runCli({ args: ["check"], cwd })).resolves.not.toThrow();
  });

  it("konsistent validate accepts the placeholders map", async () => {
    const { stdout } = await runCli({ args: ["validate"], cwd });
    expect(stdout).toContain("Configuration is valid");
  });
});

describe("convention-placeholders-broken fixture", () => {
  const cwd = resolve(fixturesDir, "convention-placeholders-broken");

  it("konsistent validate fails when a name appears in both paths and placeholders", async () => {
    try {
      await runCli({ args: ["validate"], cwd });
      expect.fail("Expected validate to exit with a non-zero code");
    } catch (err: unknown) {
      const error = err as {
        stdout: string;
        stderr: string;
        code: number;
        status: number;
      };
      expect(error.code ?? error.status).not.toBe(0);
      const output = `${error.stdout}\n${error.stderr}`;
      expect(output).toContain('declares placeholder "providerId"');
      expect(output).toContain("both in paths");
      expect(output).toContain("Pick one.");
    }
  });
});
