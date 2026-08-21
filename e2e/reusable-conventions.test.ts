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

describe("reusable-convention-string-ref fixture", () => {
  const cwd = resolve(fixturesDir, "reusable-convention-string-ref");

  it("konsistent check exits 0 when the referenced convention passes", async () => {
    await expect(runCli({ args: ["check"], cwd })).resolves.not.toThrow();
  });

  it("konsistent validate exits 0 with the path-source resolved", async () => {
    const { stdout } = await runCli({ args: ["validate"], cwd });
    expect(stdout).toContain("Configuration is valid");
  });
});

describe("reusable-convention-string-ref-broken fixture", () => {
  const cwd = resolve(fixturesDir, "reusable-convention-string-ref-broken");

  it("konsistent check exits 1 with a violation from the referenced convention", async () => {
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
      expect(error.stdout).toContain("README.md");
      expect(error.stdout).toContain("package-must-have-readme");
      expect(error.stdout).toContain("Found 1 error.");
    }
  });
});

describe("reusable-convention-object-ref fixture", () => {
  const cwd = resolve(fixturesDir, "reusable-convention-object-ref");

  it("konsistent check exits 0 when the use-form supplies paths and components are valid", async () => {
    await expect(runCli({ args: ["check"], cwd })).resolves.not.toThrow();
  });

  it("konsistent validate exits 0 with the use-form reference resolved", async () => {
    const { stdout } = await runCli({ args: ["validate"], cwd });
    expect(stdout).toContain("Configuration is valid");
  });
});

describe("reusable-convention-object-ref-broken fixture", () => {
  const cwd = resolve(fixturesDir, "reusable-convention-object-ref-broken");

  it("konsistent check exits 1 when a component folder is missing the required file", async () => {
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
      expect(error.stdout).toContain("index.ts");
      expect(error.stdout).toContain("component-folder-must-have-index");
    }
  });
});

describe("reusable-convention-top-level-if fixture", () => {
  const cwd = resolve(fixturesDir, "reusable-convention-top-level-if");

  it("combines inherited and overridden top-level if and ifNot conditions", async () => {
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
      expect(error.stdout).toContain("required.ts");
      expect(error.stdout).toContain("src/matching");
      expect(error.stdout).toContain("src/skipped");
      expect(error.stdout).not.toContain("src/negated");
      expect(error.stdout).not.toContain("src/inherited-negated");
      expect(error.stdout).toContain("Found 2 errors.");
    }
  });

  it("validates top-level condition overrides", async () => {
    const { stdout } = await runCli({ args: ["validate"], cwd });
    expect(stdout).toContain("Configuration is valid");
  });
});

describe("reusable-convention-must-block-ref fixture", () => {
  const cwd = resolve(fixturesDir, "reusable-convention-must-block-ref");

  it("konsistent check exits 0 when a must[] use ref expands and component folders are valid", async () => {
    await expect(runCli({ args: ["check"], cwd })).resolves.not.toThrow();
  });

  it("konsistent validate exits 0 with the nested use ref resolved", async () => {
    const { stdout } = await runCli({ args: ["validate"], cwd });
    expect(stdout).toContain("Configuration is valid");
  });
});

describe("reusable-convention-must-block-ref-broken fixture", () => {
  const cwd = resolve(fixturesDir, "reusable-convention-must-block-ref-broken");

  it("konsistent check exits 1 when a must[] use ref surfaces a missing-file violation", async () => {
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
      expect(error.stdout).toContain("index.ts");
      expect(error.stdout).toContain("must-have-index");
    }
  });
});

describe("reusable-convention-merge-overrides fixture", () => {
  const cwd = resolve(fixturesDir, "reusable-convention-merge-overrides");

  it("konsistent check exits 0 when override severity (warning) suppresses the missing-index violation", async () => {
    await expect(runCli({ args: ["check"], cwd })).resolves.not.toThrow();
  });

  it("konsistent validate exits 0 with merged overrides applied", async () => {
    const { stdout } = await runCli({ args: ["validate"], cwd });
    expect(stdout).toContain("Configuration is valid");
  });
});

describe("reusable-convention-merge-overrides-broken fixture", () => {
  const cwd = resolve(
    fixturesDir,
    "reusable-convention-merge-overrides-broken"
  );

  it("konsistent check exits 1 when override severity (error) and override excludeFiles surface a violation", async () => {
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
      expect(error.stdout).toContain("index.ts");
      expect(error.stdout).toContain("Bad");
      expect(error.stdout).not.toContain("src/components/Skip");
    }
  });
});

describe("reusable-convention-string-ref-pkg fixture", () => {
  const cwd = resolve(fixturesDir, "reusable-convention-string-ref-pkg");

  it("konsistent check exits 0 when @konsistent/common-conventions resolves and the convention passes", async () => {
    await expect(runCli({ args: ["check"], cwd })).resolves.not.toThrow();
  });

  it("konsistent validate exits 0 with the npm-form package source resolved", async () => {
    const { stdout } = await runCli({ args: ["validate"], cwd });
    expect(stdout).toContain("Configuration is valid");
  });
});

describe("reusable-convention-string-ref-pkg-broken fixture", () => {
  const cwd = resolve(fixturesDir, "reusable-convention-string-ref-pkg-broken");

  it("konsistent check exits 1 with a violation from package-dir-must-have-readme-file", async () => {
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
      expect(error.stdout).toContain("README.md");
      expect(error.stdout).toContain("package-dir-must-have-readme-file");
      expect(error.stdout).toContain("Found 1 error.");
    }
  });
});

describe("reusable-convention-object-ref-pkg fixture", () => {
  const cwd = resolve(fixturesDir, "reusable-convention-object-ref-pkg");

  it("konsistent check exits 0 when use-form supplies paths and components export the right name", async () => {
    await expect(runCli({ args: ["check"], cwd })).resolves.not.toThrow();
  });

  it("konsistent validate exits 0 with the use-form npm reference resolved", async () => {
    const { stdout } = await runCli({ args: ["validate"], cwd });
    expect(stdout).toContain("Configuration is valid");
  });
});

describe("reusable-convention-object-ref-pkg-broken fixture", () => {
  const cwd = resolve(fixturesDir, "reusable-convention-object-ref-pkg-broken");

  it("konsistent check exits 1 when a component file does not export the matching function", async () => {
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
        "file-must-export-equivalent-component-function"
      );
      expect(error.stdout).toContain("Card");
    }
  });
});

describe("reusable-convention-merge-overrides-pkg fixture", () => {
  const cwd = resolve(fixturesDir, "reusable-convention-merge-overrides-pkg");

  it("konsistent check exits 0 when override excludeFiles array fully replaces the base list", async () => {
    await expect(runCli({ args: ["check"], cwd })).resolves.not.toThrow();
  });

  it("konsistent validate exits 0 with merged overrides applied to the npm-form source", async () => {
    const { stdout } = await runCli({ args: ["validate"], cwd });
    expect(stdout).toContain("Configuration is valid");
  });
});

describe("reusable-convention-merge-overrides-pkg-broken fixture", () => {
  const cwd = resolve(
    fixturesDir,
    "reusable-convention-merge-overrides-pkg-broken"
  );

  it("konsistent check exits 1 because override excludeFiles replaced the base list, surfacing the missing test partner", async () => {
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
      expect(error.stdout).toContain("legacy.test.ts");
      expect(error.stdout).toContain("every-ts-file-must-have-tests");
      expect(error.stdout).toContain("Found 1 error.");
    }
  });
});

describe("reusable-convention-unknown-source fixture", () => {
  const cwd = resolve(fixturesDir, "reusable-convention-unknown-source");

  it("konsistent check exits 1 with the unknown-source error before any scan", async () => {
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
      expect(error.stderr).toContain(
        'Unknown convention source "missing" referenced in conventions[0]. Declare it in conventionSources or fix the typo.'
      );
      expect(error.stdout).not.toContain("Checked");
      expect(error.stdout).not.toContain("Found");
    }
  });
});

describe("reusable-convention-placeholder-mismatch fixture", () => {
  const cwd = resolve(fixturesDir, "reusable-convention-placeholder-mismatch");

  it("konsistent check exits 1 with a placeholder-mismatch error before any files are scanned", async () => {
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
      expect(error.stderr).toContain(
        'Convention "common/component-folder-must-have-named-file" references "${componentName}" in must.haveFiles, but neither paths nor placeholders declare "{componentName}".'
      );
      expect(error.stdout).not.toContain("Checked");
      expect(error.stdout).not.toContain("Found");
    }
  });

  it("konsistent validate exits 1 with the placeholder-mismatch error", async () => {
    try {
      await runCli({ args: ["validate"], cwd });
      expect.fail("Expected validate to exit with code 1");
    } catch (err: unknown) {
      const error = err as {
        stdout: string;
        stderr: string;
        code: number;
        status: number;
      };
      expect(error.code ?? error.status).toBe(1);
      expect(error.stderr).toContain(
        'Convention "common/component-folder-must-have-named-file" references "${componentName}" in must.haveFiles, but neither paths nor placeholders declare "{componentName}".'
      );
    }
  });
});
