import { execFile as execFileCallback } from "node:child_process";
import { resolve } from "node:path";
import { promisify } from "node:util";
import { describe, expect, it } from "vitest";

const execFile = promisify(execFileCallback);
const cliBinary = resolve(
  import.meta.dirname,
  "../packages/konsistent/dist/cli.js"
);
const fixtureDirectory = resolve(
  import.meta.dirname,
  "fixtures/directory-typescript-predicates"
);

function runCli(opts: { args?: string[] } = {}) {
  return execFile(
    process.execPath,
    [cliBinary, "check", ...(opts.args ?? [])],
    {
      cwd: fixtureDirectory,
      env: {
        ...process.env,
        GITHUB_ACTIONS: "",
        KONSISTENT_NO_UPDATE_CHECK: "true",
      },
    }
  );
}

describe("TypeScript predicates matched to directories", () => {
  it("reports a helpful default diagnostic instead of an EISDIR stack trace", async () => {
    try {
      await runCli();
      expect.fail("Expected the invalid predicate context to fail the check");
    } catch (error) {
      const result = error as {
        code?: number;
        stderr: string;
        status: number;
        stdout: string;
      };

      expect(result.code ?? result.status).toBe(1);
      expect(result.stdout).toContain("packages/demo");
      expect(result.stdout).toContain("directory-import-restrictions");
      expect(result.stdout).toContain("mustNot.importValuesFrom");
      expect(result.stdout).toContain('Use a "for.files" block');
      expect(result.stdout).toContain("Found 1 error.");
      expect(result.stderr).not.toContain("EISDIR");
      expect(result.stderr).not.toContain("readFileSync");
    }
  });

  it("includes the predicate field and directory path in JSON diagnostics", async () => {
    try {
      await runCli({ args: ["--format=json"] });
      expect.fail("Expected the invalid predicate context to fail the check");
    } catch (error) {
      const result = error as {
        code?: number;
        status: number;
        stdout: string;
      };

      expect(result.code ?? result.status).toBe(1);
      expect(JSON.parse(result.stdout)).toEqual([
        expect.objectContaining({
          conventionName: "directory-import-restrictions",
          filePath: "packages/demo",
          message: expect.stringContaining("requires a file"),
          predicateName: "mustNot.importValuesFrom",
          severity: "error",
        }),
      ]);
    }
  });
});
