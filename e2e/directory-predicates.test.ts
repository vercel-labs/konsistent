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

function runCli(opts: { cwd: string }) {
  return execFile("node", [cliBinary, "check"], {
    cwd: opts.cwd,
    env: { ...process.env, GITHUB_ACTIONS: "" },
  });
}

describe("directory predicate fixtures", () => {
  it("accepts root or nested directory matches", async () => {
    const cwd = resolve(fixturesDir, "directory-predicates");
    await expect(runCli({ cwd })).resolves.not.toThrow();
  });

  it("reports missing and forbidden directory matches independently", async () => {
    const cwd = resolve(fixturesDir, "directory-predicates-broken");
    try {
      await runCli({ cwd });
      expect.fail("Expected check to exit with code 1");
    } catch (err: unknown) {
      const error = err as { stdout: string; code: number; status: number };
      expect(error.code ?? error.status).toBe(1);
      expect(error.stdout).toContain("modules/file-only");
      expect(error.stdout).toContain("modules/missing");
      expect(error.stdout).toContain(
        "Missing required directory: instructions/*.{md,ts}"
      );
      expect(error.stdout).toContain("Missing required directory: metadata/*");
      expect(error.stdout).toContain("modules/forbidden");
      expect(error.stdout).toContain('Forbidden directory "secret/*"');
      expect(error.stdout).toContain('Forbidden directory "forbidden/*"');
    }
  });
});
