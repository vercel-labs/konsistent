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

function runCli(opts: { cwd: string; args?: string[] }) {
  return execFile("node", [cliBinary, ...(opts.args ?? ["check"])], {
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
        'Constant "localAuths" must be an array with items of type "Readonly<MyAuth>"'
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
      expect(error.stdout).toContain(
        'Constant "optionalOptions" property "metadata" must be optional'
      );
      expect(error.stdout).toContain(
        'Constant "authSettings" property "auth" must be of type "Readonly<MyAuth>"'
      );
    }
  });
});

describe("type-schemas fixture", () => {
  const cwd = resolve(fixturesDir, "type-schemas");

  it("konsistent check exits 0 for partial type schema matches", async () => {
    await expect(runCli({ cwd })).resolves.not.toThrow();
  });
});

describe("type-schemas-broken fixture", () => {
  const cwd = resolve(fixturesDir, "type-schemas-broken");

  it("konsistent check exits 1 for a missing configured property", async () => {
    try {
      await runCli({ cwd });
      expect.fail("Expected check to exit with code 1");
    } catch (err: unknown) {
      const error = err as { stdout: string; code: number; status: number };
      expect(error.code ?? error.status).toBe(1);
      expect(error.stdout).toContain(
        'Type "ModuleSettings" must define property "timeout"'
      );
      expect(error.stdout).toContain(
        'Type "InternalSettings" property "auth" must be of type "Readonly<MyAuth>"'
      );
      expect(error.stdout).toContain("type-schemas");
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

describe("import-values-and-types-from fixture", () => {
  const cwd = resolve(fixturesDir, "import-values-and-types-from");

  it("passes importValuesFrom and importTypesFrom in must and mustNot", async () => {
    await expect(runCli({ cwd })).resolves.not.toThrow();
  });
});

describe("import-values-and-types-from-broken fixture", () => {
  const cwd = resolve(fixturesDir, "import-values-and-types-from-broken");

  it("fails importValuesFrom and importTypesFrom in must and mustNot", async () => {
    try {
      await runCli({ cwd });
      expect.fail("Expected check to exit with code 1");
    } catch (err: unknown) {
      const error = err as { stdout: string; code: number; status: number };
      expect(error.code ?? error.status).toBe(1);
      expect(error.stdout).toContain('Missing import from "./helper"');
      expect(error.stdout).toContain('Missing type import from "@scope/pkg/*"');
      expect(error.stdout).toContain('Missing import from "react"');
      expect(error.stdout).toContain('Forbidden import from "react"');
      expect(error.stdout).toContain('Forbidden import from "package/*"');
      expect(error.stdout).toContain(
        'Forbidden type import from "types-package/*"'
      );
      expect(error.stdout).toContain('Missing import from "@vendor/*"');
      expect(error.stdout).toContain(
        'Missing type import from "@type-vendor/*"'
      );
      expect(error.stdout).toContain(
        'Forbidden import from "@blocked-vendor/*"'
      );
      expect(error.stdout).toContain(
        'Forbidden type import from "@blocked-types-vendor/*"'
      );
      expect(error.stdout).toContain('Missing import from "@ai-sdk/*"');
      expect(error.stdout).toContain(
        'Missing type import from "@vendor/project/*"'
      );
      expect(error.stdout).toContain('Forbidden import from "@ai-sdk/*"');
      expect(error.stdout).toContain(
        'Forbidden type import from "@vendor/project/*"'
      );
    }
  });
});

describe("import-source-selectors-invalid fixture", () => {
  const cwd = resolve(fixturesDir, "import-source-selectors-invalid");

  it("fails konsistent validate for an unrelated exclusion", async () => {
    try {
      await runCli({ cwd, args: ["validate"] });
      expect.fail("Expected validate to exit with code 1");
    } catch (err: unknown) {
      const error = err as {
        stderr: string;
        code: number;
        status: number;
      };
      expect(error.code ?? error.status).toBe(1);
      expect(error.stderr).toContain(
        'Import source pattern "react" must be strictly nested under wildcard selector "@ai-sdk/*"'
      );
    }
  });
});

describe("import-conditions fixture", () => {
  const cwd = resolve(fixturesDir, "import-conditions");

  it("passes value and type import conditions", async () => {
    await expect(runCli({ cwd })).resolves.not.toThrow();
  });
});

describe("import-conditions-broken fixture", () => {
  const cwd = resolve(fixturesDir, "import-conditions-broken");

  it("reports predicates gated by matching import conditions", async () => {
    try {
      await runCli({ cwd });
      expect.fail("Expected check to exit with code 1");
    } catch (err: unknown) {
      const error = err as { stdout: string; code: number; status: number };
      expect(error.code ?? error.status).toBe(1);
      expect(error.stdout).toContain("value-import-condition");
      expect(error.stdout).toContain("type-import-condition");
      expect(error.stdout).toContain("value-import-from-condition");
      expect(error.stdout).toContain("type-import-from-condition");
      expect(error.stdout).toContain("Found 4 errors.");
    }
  });
});

describe("symbol-aliases fixture", () => {
  const cwd = resolve(fixturesDir, "symbol-aliases");

  it("passes aliases and alias-insensitive checks in must and mustNot", async () => {
    await expect(runCli({ cwd })).resolves.not.toThrow();
  });
});

describe("symbol-aliases-broken fixture", () => {
  const cwd = resolve(fixturesDir, "symbol-aliases-broken");

  it("fails incorrect and forbidden value and type aliases", async () => {
    try {
      await runCli({ cwd });
      expect.fail("Expected check to exit with code 1");
    } catch (err: unknown) {
      const error = err as { stdout: string; code: number; status: number };
      expect(error.code ?? error.status).toBe(1);
      expect(error.stdout).toContain(
        'Missing import "createClient" as "createApiClient"'
      );
      expect(error.stdout).toContain(
        'Missing import type "ClientConfig" as "ApiClientConfig"'
      );
      expect(error.stdout).toContain(
        'Missing export "createProvider" as "createApiProvider"'
      );
      expect(error.stdout).toContain(
        'Missing export type "LocalSettings" as "PublicSettings"'
      );
      expect(error.stdout).toContain(
        'Forbidden import "blockedImport" as "forbiddenLocalImport"'
      );
      expect(error.stdout).toContain('Forbidden import "anyAliasImport"');
      expect(error.stdout).toContain(
        'Forbidden type import "BlockedType" as "ForbiddenLocalType"'
      );
      expect(error.stdout).toContain('Forbidden type import "AnyAliasType"');
      expect(error.stdout).toContain(
        'Forbidden export "blockedExport" as "forbiddenPublicExport"'
      );
      expect(error.stdout).toContain('Forbidden export "anyAliasExport"');
      expect(error.stdout).toContain(
        'Forbidden type export "BlockedExportType" as "ForbiddenPublicType"'
      );
      expect(error.stdout).toContain(
        'Forbidden type export "AnyAliasExportType"'
      );
    }
  });
});
