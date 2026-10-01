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

describe("file predicate glob fixtures", () => {
  it("accepts either root file extension or a nested matching file", async () => {
    const cwd = resolve(fixturesDir, "file-predicate-globs");
    await expect(runCli({ cwd })).resolves.not.toThrow();
  });

  it("reports unmatched patterns independently and forbids any glob match", async () => {
    const cwd = resolve(fixturesDir, "file-predicate-globs-broken");
    try {
      await runCli({ cwd });
      expect.fail("Expected check to exit with code 1");
    } catch (err: unknown) {
      const error = err as { stdout: string; code: number; status: number };
      expect(error.code ?? error.status).toBe(1);
      expect(error.stdout).toContain("modules/missing");
      expect(error.stdout).toContain("modules/directory-only");
      expect(error.stdout).toContain(
        "Missing required file: instructions/*.{md,ts}"
      );
      expect(error.stdout).toContain("modules/missing-marker");
      expect(error.stdout).toContain("Missing required file: marker.ts");
      expect(error.stdout).toContain("modules/forbidden");
      expect(error.stdout).toContain('Forbidden file "forbidden/*.{md,ts}"');
      expect(error.stdout).not.toContain("modules/root-skip");
    }
  });
});
