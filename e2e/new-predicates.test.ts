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

function runCli(opts: { cwd: string }) {
  return execFile("node", [cliBinary, "check"], {
    cwd: opts.cwd,
    env: { ...process.env, GITHUB_ACTIONS: "" },
  });
}

describe("declaration-predicates fixture", () => {
  const cwd = resolve(fixturesDir, "declaration-predicates");

  it("konsistent check exits 0 when all local declarations pass", async () => {
    await expect(runCli({ cwd })).resolves.not.toThrow();
  });
});

describe("declaration-predicates-broken fixture", () => {
  const cwd = resolve(fixturesDir, "declaration-predicates-broken");

  it("konsistent check exits 1 with declaration violations", async () => {
    try {
      await runCli({ cwd });
      expect.fail("Expected check to exit with code 1");
    } catch (err: unknown) {
      const error = err as { stdout: string; code: number; status: number };
      expect(error.code ?? error.status).toBe(1);
      expect(error.stdout).toContain(
        'Local type declaration "LocalType" must not be exported'
      );
      expect(error.stdout).toContain(
        'Local function declaration "createLocal" must not be exported'
      );
      expect(error.stdout).toContain("local-declarations");
    }
  });
});

describe("constant-schemas fixture", () => {
  const cwd = resolve(fixturesDir, "constant-schemas");

  it("konsistent check exits 0 when constant schemas match", async () => {
    await expect(runCli({ cwd })).resolves.not.toThrow();
  });
});

describe("constant-schemas-broken fixture", () => {
  const cwd = resolve(fixturesDir, "constant-schemas-broken");

  it("konsistent check exits 1 with constant schema violations", async () => {
    try {
      await runCli({ cwd });
      expect.fail("Expected check to exit with code 1");
    } catch (err: unknown) {
      const error = err as { stdout: string; code: number; status: number };
      expect(error.code ?? error.status).toBe(1);
      expect(error.stdout).toContain(
        'Constant "localPort" must have an explicit type annotation'
      );
      expect(error.stdout).toContain(
        'Constant "mode" must have exactly the configured enum values'
      );
      expect(error.stdout).toContain(
        'Constant "tags" must be an array with items of type "string"'
      );
      expect(error.stdout).toContain(
        'Constant "options" must not have additional property "retries"'
      );
    }
  });
});

describe("declaration-order fixture", () => {
  const cwd = resolve(fixturesDir, "declaration-order");

  it("konsistent check exits 0 when declarations are ordered", async () => {
    await expect(runCli({ cwd })).resolves.not.toThrow();
  });
});

describe("declaration-order-broken fixture", () => {
  const cwd = resolve(fixturesDir, "declaration-order-broken");

  it("konsistent check exits 1 with declaration order violations", async () => {
    try {
      await runCli({ cwd });
      expect.fail("Expected check to exit with code 1");
    } catch (err: unknown) {
      const error = err as { stdout: string; code: number; status: number };
      expect(error.code ?? error.status).toBe(1);
      expect(error.stdout).toContain(
        'Symbol "alpha" must be declared before "Beta"'
      );
      expect(error.stdout).toContain("declarations-in-order");
    }
  });
});

describe("import-source-groups fixture", () => {
  const cwd = resolve(fixturesDir, "import-source-groups");

  it("konsistent check exits 0 when import source groups pass", async () => {
    await expect(runCli({ cwd })).resolves.not.toThrow();
  });
});

describe("import-source-groups-broken fixture", () => {
  const cwd = resolve(fixturesDir, "import-source-groups-broken");

  it("konsistent check exits 1 with import source group violations", async () => {
    try {
      await runCli({ cwd });
      expect.fail("Expected check to exit with code 1");
    } catch (err: unknown) {
      const error = err as { stdout: string; code: number; status: number };
      expect(error.code ?? error.status).toBe(1);
      expect(error.stdout).toContain("Missing import from current directory");
      expect(error.stdout).toContain(
        "Import from parent directories is not allowed"
      );
      expect(error.stdout).toContain("Missing import from external packages");
      expect(error.stdout).toContain(
        "Import from current directory is not allowed"
      );
      expect(error.stdout).toContain(
        "Missing type import from current directory"
      );
      expect(error.stdout).toContain(
        "Type import from parent directories is not allowed"
      );
      expect(error.stdout).toContain(
        "Missing type import from external packages"
      );
      expect(error.stdout).toContain(
        "Type import from current directory is not allowed"
      );
    }
  });
});

describe("import-from fixture", () => {
  const cwd = resolve(fixturesDir, "import-from");

  it("konsistent check exits 0 when importFrom predicates pass", async () => {
    await expect(runCli({ cwd })).resolves.not.toThrow();
  });
});

describe("import-from-broken fixture", () => {
  const cwd = resolve(fixturesDir, "import-from-broken");

  it("konsistent check exits 1 with importFrom violations", async () => {
    try {
      await runCli({ cwd });
      expect.fail("Expected check to exit with code 1");
    } catch (err: unknown) {
      const error = err as { stdout: string; code: number; status: number };
      expect(error.code ?? error.status).toBe(1);
      expect(error.stdout).toContain('Missing import from "./helper"');
      expect(error.stdout).toContain('Missing import from "@scope/pkg/*"');
      expect(error.stdout).toContain('Missing import from "react"');
      expect(error.stdout).toContain('Forbidden import from "react"');
      expect(error.stdout).toContain('Forbidden import from "package/*"');
    }
  });
});
