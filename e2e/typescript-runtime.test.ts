import { execFile as execFileCallback } from "node:child_process";
import { resolve } from "node:path";
import { promisify } from "node:util";
import { describe, expect, it } from "vitest";

const execFile = promisify(execFileCallback);
const cli = resolve(import.meta.dirname, "../packages/konsistent/dist/cli.js");
const fixturesDirectory = resolve(import.meta.dirname, "fixtures");
const allowedTypeScriptStderr = /^(?:|context canceled\r?\n?)$/;

function runCli(opts: { fixture: string; args?: string[] }) {
  return execFile(
    process.execPath,
    [cli, ...(opts.args ?? ["check", "--format=json"])],
    {
      cwd: resolve(fixturesDirectory, opts.fixture),
      timeout: 10_000,
      env: {
        ...process.env,
        KONSISTENT_NO_UPDATE_CHECK: "true",
        GITHUB_ACTIONS: "",
      },
    }
  );
}

describe("TypeScript 7 runtime", () => {
  it("preserves syntax-only checks, nested conditions, JSX, and argument prefixes", async () => {
    const result = await runCli({ fixture: "typescript-runtime" });
    expect(JSON.parse(result.stdout)).toEqual([]);
    expect(result.stderr).toBe("");
  });

  it("preserves violations, Unicode positions, literal spelling, and exit codes", async () => {
    await expect(
      runCli({ fixture: "typescript-runtime-broken" })
    ).rejects.toMatchObject({
      code: 1,
      /*
       * TypeScript 7.0.2 may emit this during cancellation after a failed
       * check. Accept only this exact output until a stable release includes
       * the fix from microsoft/TypeScript#64276.
       */
      stderr: expect.stringMatching(allowedTypeScriptStderr),
    });
    try {
      await runCli({ fixture: "typescript-runtime-broken" });
      expect.fail("Expected violations");
    } catch (error) {
      const diagnostics = JSON.parse((error as { stdout: string }).stdout);
      expect(diagnostics).toHaveLength(4);
      expect(diagnostics).toContainEqual(
        expect.objectContaining({
          predicateName: "exportConstants",
          line: 2,
          message: 'Constant "café" must be of type "number"',
        })
      );
      expect(diagnostics).toContainEqual(
        expect.objectContaining({
          predicateName: "exportConstants",
          line: 4,
          message: 'Constant "count" must have type "16"',
        })
      );
      expect(diagnostics).toContainEqual(
        expect.objectContaining({ predicateName: "callFunction" })
      );
      expect(diagnostics).toContainEqual(
        expect.objectContaining({
          predicateName: "exportTypes",
          line: 3,
        })
      );
    }
  });

  it("runs filesystem-only checks and validation", async () => {
    expect(
      JSON.parse(
        (await runCli({ fixture: "typescript-runtime-filesystem" })).stdout
      )
    ).toEqual([]);
    expect(
      (await runCli({ fixture: "typescript-runtime", args: ["validate"] }))
        .stdout
    ).toContain("Configuration is valid.");
  });
});
