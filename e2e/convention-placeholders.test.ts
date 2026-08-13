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

describe("cli-placeholder-override fixture", () => {
  const cwd = resolve(fixturesDir, "cli-placeholder-override");

  it("konsistent check fails with the JSON-defined placeholder value", async () => {
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
      expect(error.stdout).toContain("Missing required file");
      expect(error.stdout).toContain("openai-provider.ts");
    }
  });

  it("konsistent check passes when --placeholder overrides the JSON value", async () => {
    await expect(
      runCli({ args: ["check", "--placeholder", "providerId:anthropic"], cwd })
    ).resolves.not.toThrow();
  });

  it("konsistent validate fails when --placeholder collides with a path-captured name", async () => {
    const collidingCwd = resolve(fixturesDir, "placeholder-satisfies");
    try {
      await runCli({
        args: ["validate", "--placeholder", "providerId:openai"],
        cwd: collidingCwd,
      });
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
      expect(output).toContain('--placeholder "providerId:openai"');
      expect(output).toContain('captures "{providerId}" from paths');
    }
  });

  it("konsistent check rejects a malformed --placeholder value", async () => {
    const cwd2 = resolve(fixturesDir, "convention-placeholders");
    try {
      await runCli({
        args: ["check", "--placeholder", "no-colon-here"],
        cwd: cwd2,
      });
      expect.fail("Expected check to exit with a non-zero code");
    } catch (err: unknown) {
      const error = err as { stderr: string; code: number; status: number };
      expect(error.code ?? error.status).not.toBe(0);
      expect(error.stderr).toContain('Invalid --placeholder "no-colon-here"');
    }
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
