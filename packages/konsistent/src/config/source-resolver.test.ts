import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { resolveSources } from "./source-resolver.js";

const NOT_INSTALLED_HINT_PATTERN = /may not be installed|could not resolve/;

let tmpDir: string;

beforeEach(() => {
  tmpDir = mkdtempSync(join(tmpdir(), "konsistent-source-resolver-"));
});

afterEach(() => {
  rmSync(tmpDir, { recursive: true, force: true });
});

function setupNpmFixture(opts: {
  packageName: string;
  packageJson: Record<string, unknown>;
  conventionsContent?: string;
  conventionsRelPath?: string;
}): { configDir: string; pkgDir: string } {
  const { packageName, packageJson, conventionsContent, conventionsRelPath } =
    opts;

  const configDir = join(tmpDir, "consumer");
  mkdirSync(configDir, { recursive: true });

  const pkgDir = join(configDir, "node_modules", ...packageName.split("/"));
  mkdirSync(pkgDir, { recursive: true });

  writeFileSync(join(pkgDir, "package.json"), JSON.stringify(packageJson));

  if (conventionsContent !== undefined) {
    const target = join(pkgDir, conventionsRelPath ?? "conventions.json");
    mkdirSync(join(target, ".."), { recursive: true });
    writeFileSync(target, conventionsContent);
  }

  return { configDir, pkgDir };
}

describe("resolveSources", () => {
  it("resolves a path-form source relative to the config dir", async () => {
    writeFileSync(
      join(tmpDir, "common.json"),
      JSON.stringify({
        conventionSpecVersion: "v1",
        conventions: [
          {
            name: "must-have-readme",
            description: "Every package must have a README.md.",
            paths: ["packages/{packageName}"],
            must: { haveFiles: ["README.md"] },
          },
        ],
      })
    );

    const result = await resolveSources({
      conventionSources: { common: "./common.json" },
      configDir: tmpDir,
    });

    expect(result.success).toBe(true);
    if (result.success) {
      const map = result.sourceMap.get("common");
      expect(map).toBeDefined();
      expect(map?.get("must-have-readme")?.description).toBe(
        "Every package must have a README.md."
      );
    }
  });

  it("resolves an absolute-path source", async () => {
    const absPath = join(tmpDir, "abs.json");
    writeFileSync(
      absPath,
      JSON.stringify({
        conventionSpecVersion: "v1",
        conventions: [
          {
            name: "x",
            description: "y",
            paths: "src/*.ts",
            must: { haveType: "file" },
          },
        ],
      })
    );

    const result = await resolveSources({
      conventionSources: { common: absPath },
      configDir: tmpDir,
    });

    expect(result.success).toBe(true);
  });

  it("returns error with the failing path when file is missing", async () => {
    const result = await resolveSources({
      conventionSources: { common: "./missing.json" },
      configDir: tmpDir,
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toContain('"common"');
      expect(result.error).toContain("./missing.json");
      expect(result.error).toContain("could not read");
    }
  });

  it("returns error when JSON is malformed", async () => {
    writeFileSync(join(tmpDir, "bad.json"), "{ not json");

    const result = await resolveSources({
      conventionSources: { common: "./bad.json" },
      configDir: tmpDir,
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toContain("malformed JSON");
      expect(result.error).toContain('"common"');
    }
  });

  it("returns error with a clear path when the package does not match the schema", async () => {
    writeFileSync(
      join(tmpDir, "bad-shape.json"),
      JSON.stringify({
        conventionSpecVersion: "v2",
        conventions: [],
      })
    );

    const result = await resolveSources({
      conventionSources: { common: "./bad-shape.json" },
      configDir: tmpDir,
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toContain("invalid reusable-convention package");
      expect(result.error).toContain("conventionSpecVersion");
    }
  });

  it("returns an empty source map for empty conventionSources", async () => {
    const result = await resolveSources({
      conventionSources: {},
      configDir: tmpDir,
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.sourceMap.size).toBe(0);
    }
  });

  it("rejects empty-string source values with a precise error", async () => {
    const result = await resolveSources({
      conventionSources: { common: "" },
      configDir: tmpDir,
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toContain('"common"');
      expect(result.error).toContain("empty value");
    }
  });

  it("rejects whitespace-only source values with a precise error", async () => {
    const result = await resolveSources({
      conventionSources: { common: "   " },
      configDir: tmpDir,
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toContain('"common"');
      expect(result.error).toContain("empty value");
    }
  });

  it("resolves an npm-form specifier through the konsistent exports condition", async () => {
    const { configDir } = setupNpmFixture({
      packageName: "@scope/sample-conventions",
      packageJson: {
        name: "@scope/sample-conventions",
        version: "0.0.0",
        type: "module",
        exports: {
          "./konsistent": "./conventions.json",
        },
      },
      conventionsContent: JSON.stringify({
        conventionSpecVersion: "v1",
        conventions: [
          {
            name: "must-have-readme",
            description: "Every package must have a README.md.",
            paths: ["packages/{packageName}"],
            must: { haveFiles: ["README.md"] },
          },
        ],
      }),
    });

    const result = await resolveSources({
      conventionSources: { common: "@scope/sample-conventions" },
      configDir,
    });

    expect(result.success).toBe(true);
    if (result.success) {
      const map = result.sourceMap.get("common");
      expect(map).toBeDefined();
      expect(map?.get("must-have-readme")?.description).toBe(
        "Every package must have a README.md."
      );
    }
  });

  it("prefers the konsistent condition over default in conditional exports", async () => {
    const { configDir, pkgDir } = setupNpmFixture({
      packageName: "@scope/conditional-conventions",
      packageJson: {
        name: "@scope/conditional-conventions",
        version: "0.0.0",
        type: "module",
        exports: {
          "./konsistent": {
            konsistent: "./konsistent.json",
            default: "./default.json",
          },
        },
      },
    });

    writeFileSync(
      join(pkgDir, "konsistent.json"),
      JSON.stringify({
        conventionSpecVersion: "v1",
        conventions: [
          {
            name: "from-konsistent",
            description: "Loaded from the konsistent condition.",
            paths: "src/*.ts",
            must: { haveType: "file" },
          },
        ],
      })
    );
    writeFileSync(
      join(pkgDir, "default.json"),
      JSON.stringify({
        conventionSpecVersion: "v1",
        conventions: [],
      })
    );

    const result = await resolveSources({
      conventionSources: { common: "@scope/conditional-conventions" },
      configDir,
    });

    expect(result.success).toBe(true);
    if (result.success) {
      const map = result.sourceMap.get("common");
      expect(map?.get("from-konsistent")).toBeDefined();
    }
  });

  it("errors with the specifier when the npm package is not installed", async () => {
    const configDir = join(tmpDir, "consumer");
    mkdirSync(configDir, { recursive: true });

    const result = await resolveSources({
      conventionSources: {
        common: "@konsistent-test/definitely-not-installed",
      },
      configDir,
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toContain('"common"');
      expect(result.error).toContain(
        "@konsistent-test/definitely-not-installed"
      );
      expect(result.error).toMatch(NOT_INSTALLED_HINT_PATTERN);
      expect(result.error).not.toContain("not yet supported");
    }
  });

  it("errors clearly when the npm package lacks the './konsistent' export", async () => {
    const { configDir } = setupNpmFixture({
      packageName: "@scope/no-konsistent-export",
      packageJson: {
        name: "@scope/no-konsistent-export",
        version: "0.0.0",
        type: "module",
        exports: {
          ".": "./index.js",
        },
      },
    });

    const result = await resolveSources({
      conventionSources: { common: "@scope/no-konsistent-export" },
      configDir,
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toContain("@scope/no-konsistent-export");
      expect(result.error).toContain('"./konsistent"');
      expect(result.error).toContain("does not declare");
    }
  });

  it("errors clearly when the npm package has no exports map at all", async () => {
    const { configDir } = setupNpmFixture({
      packageName: "@scope/no-exports",
      packageJson: {
        name: "@scope/no-exports",
        version: "0.0.0",
        type: "module",
      },
    });

    const result = await resolveSources({
      conventionSources: { common: "@scope/no-exports" },
      configDir,
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toContain("@scope/no-exports");
      expect(result.error).toContain("does not declare");
    }
  });

  it("includes the npm specifier when the resolved JSON fails Zod validation", async () => {
    const { configDir } = setupNpmFixture({
      packageName: "@scope/bad-shape",
      packageJson: {
        name: "@scope/bad-shape",
        version: "0.0.0",
        type: "module",
        exports: {
          "./konsistent": "./conventions.json",
        },
      },
      conventionsContent: JSON.stringify({
        conventionSpecVersion: "v2",
        conventions: [],
      }),
    });

    const result = await resolveSources({
      conventionSources: { common: "@scope/bad-shape" },
      configDir,
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toContain("@scope/bad-shape");
      expect(result.error).toContain("invalid reusable-convention package");
      expect(result.error).toContain("conventionSpecVersion");
    }
  });

  it('rejects exports["./konsistent"] entries that escape the package via ..', async () => {
    const { configDir } = setupNpmFixture({
      packageName: "@scope/escape-exports-relative",
      packageJson: {
        name: "@scope/escape-exports-relative",
        version: "0.0.0",
        type: "module",
        exports: {
          "./konsistent": "../../../../../../etc/conventions.json",
        },
      },
    });

    const result = await resolveSources({
      conventionSources: { common: "@scope/escape-exports-relative" },
      configDir,
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toContain("outside the package directory");
    }
  });

  it("includes the npm specifier when the resolved JSON is malformed", async () => {
    const { configDir } = setupNpmFixture({
      packageName: "@scope/malformed-json",
      packageJson: {
        name: "@scope/malformed-json",
        version: "0.0.0",
        type: "module",
        exports: {
          "./konsistent": "./conventions.json",
        },
      },
      conventionsContent: "{ not json",
    });

    const result = await resolveSources({
      conventionSources: { common: "@scope/malformed-json" },
      configDir,
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toContain("@scope/malformed-json");
      expect(result.error).toContain("malformed JSON");
    }
  });

  describe("auto-detection routing", () => {
    it("routes './local.json' to the path-form branch", async () => {
      const result = await resolveSources({
        conventionSources: { common: "./local.json" },
        configDir: tmpDir,
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toContain("could not read file");
        expect(result.error).toContain("./local.json");
      }
    });

    it("routes an absolute path to the path-form branch", async () => {
      const result = await resolveSources({
        conventionSources: { common: "/abs/path.json" },
        configDir: tmpDir,
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toContain("could not read file");
        expect(result.error).toContain("/abs/path.json");
      }
    });

    it("routes a scoped npm package to the npm-form branch", async () => {
      const configDir = join(tmpDir, "consumer");
      mkdirSync(configDir, { recursive: true });

      const result = await resolveSources({
        conventionSources: { common: "@scope/pkg" },
        configDir,
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toContain("@scope/pkg");
        expect(result.error).not.toContain("not yet supported");
        expect(result.error).not.toContain("could not read file");
      }
    });

    it("routes a bare-package specifier to the npm-form branch", async () => {
      const configDir = join(tmpDir, "consumer");
      mkdirSync(configDir, { recursive: true });

      const result = await resolveSources({
        conventionSources: { common: "bare-pkg" },
        configDir,
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toContain("bare-pkg");
        expect(result.error).not.toContain("not yet supported");
        expect(result.error).not.toContain("could not read file");
      }
    });

    it("routes a 'pkg/subpath' specifier to the npm-form branch", async () => {
      const configDir = join(tmpDir, "consumer");
      mkdirSync(configDir, { recursive: true });

      const result = await resolveSources({
        conventionSources: { common: "pkg/subpath" },
        configDir,
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toContain("pkg/subpath");
        expect(result.error).not.toContain("not yet supported");
        expect(result.error).not.toContain("could not read file");
      }
    });
  });
});
