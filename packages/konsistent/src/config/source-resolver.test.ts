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
  rmSync(tmpDir, { force: true, recursive: true });
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
            description: "Every package must have a README.md.",
            must: { haveFiles: ["README.md"] },
            name: "must-have-readme",
            paths: ["packages/{packageName}"],
          },
        ],
      })
    );

    const result = await resolveSources({
      configDir: tmpDir,
      conventionSources: { common: "./common.json" },
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
            description: "y",
            must: { haveType: "file" },
            name: "x",
            paths: "src/*.ts",
          },
        ],
      })
    );

    const result = await resolveSources({
      configDir: tmpDir,
      conventionSources: { common: absPath },
    });

    expect(result.success).toBe(true);
  });

  it("returns error with the failing path when file is missing", async () => {
    const result = await resolveSources({
      configDir: tmpDir,
      conventionSources: { common: "./missing.json" },
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
      configDir: tmpDir,
      conventionSources: { common: "./bad.json" },
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
      configDir: tmpDir,
      conventionSources: { common: "./bad-shape.json" },
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toContain("invalid reusable-convention package");
      expect(result.error).toContain("conventionSpecVersion");
    }
  });

  it("returns an empty source map for empty conventionSources", async () => {
    const result = await resolveSources({
      configDir: tmpDir,
      conventionSources: {},
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.sourceMap.size).toBe(0);
    }
  });

  it("rejects empty-string source values with a precise error", async () => {
    const result = await resolveSources({
      configDir: tmpDir,
      conventionSources: { common: "" },
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toContain('"common"');
      expect(result.error).toContain("empty value");
    }
  });

  it("rejects whitespace-only source values with a precise error", async () => {
    const result = await resolveSources({
      configDir: tmpDir,
      conventionSources: { common: "   " },
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toContain('"common"');
      expect(result.error).toContain("empty value");
    }
  });

  it("resolves an npm-form specifier through the konsistent exports condition", async () => {
    const { configDir } = setupNpmFixture({
      conventionsContent: JSON.stringify({
        conventionSpecVersion: "v1",
        conventions: [
          {
            description: "Every package must have a README.md.",
            must: { haveFiles: ["README.md"] },
            name: "must-have-readme",
            paths: ["packages/{packageName}"],
          },
        ],
      }),
      packageJson: {
        exports: {
          "./konsistent": "./conventions.json",
        },
        name: "@scope/sample-conventions",
        type: "module",
        version: "0.0.0",
      },
      packageName: "@scope/sample-conventions",
    });

    const result = await resolveSources({
      configDir,
      conventionSources: { common: "@scope/sample-conventions" },
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
    const conditionalExports = Object.create(null) as Record<string, string>;
    conditionalExports.konsistent = "./konsistent.json";
    conditionalExports.default = "./default.json";
    const { configDir, pkgDir } = setupNpmFixture({
      packageJson: {
        exports: {
          "./konsistent": conditionalExports,
        },
        name: "@scope/conditional-conventions",
        type: "module",
        version: "0.0.0",
      },
      packageName: "@scope/conditional-conventions",
    });

    writeFileSync(
      join(pkgDir, "konsistent.json"),
      JSON.stringify({
        conventionSpecVersion: "v1",
        conventions: [
          {
            description: "Loaded from the konsistent condition.",
            must: { haveType: "file" },
            name: "from-konsistent",
            paths: "src/*.ts",
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
      configDir,
      conventionSources: { common: "@scope/conditional-conventions" },
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
      configDir,
      conventionSources: {
        common: "@konsistent-test/definitely-not-installed",
      },
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
      packageJson: {
        exports: {
          ".": "./index.js",
        },
        name: "@scope/no-konsistent-export",
        type: "module",
        version: "0.0.0",
      },
      packageName: "@scope/no-konsistent-export",
    });

    const result = await resolveSources({
      configDir,
      conventionSources: { common: "@scope/no-konsistent-export" },
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
      packageJson: {
        name: "@scope/no-exports",
        type: "module",
        version: "0.0.0",
      },
      packageName: "@scope/no-exports",
    });

    const result = await resolveSources({
      configDir,
      conventionSources: { common: "@scope/no-exports" },
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toContain("@scope/no-exports");
      expect(result.error).toContain("does not declare");
    }
  });

  it("includes the npm specifier when the resolved JSON fails Zod validation", async () => {
    const { configDir } = setupNpmFixture({
      conventionsContent: JSON.stringify({
        conventionSpecVersion: "v2",
        conventions: [],
      }),
      packageJson: {
        exports: {
          "./konsistent": "./conventions.json",
        },
        name: "@scope/bad-shape",
        type: "module",
        version: "0.0.0",
      },
      packageName: "@scope/bad-shape",
    });

    const result = await resolveSources({
      configDir,
      conventionSources: { common: "@scope/bad-shape" },
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
      packageJson: {
        exports: {
          "./konsistent": "../../../../../../etc/conventions.json",
        },
        name: "@scope/escape-exports-relative",
        type: "module",
        version: "0.0.0",
      },
      packageName: "@scope/escape-exports-relative",
    });

    const result = await resolveSources({
      configDir,
      conventionSources: { common: "@scope/escape-exports-relative" },
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toContain("outside the package directory");
    }
  });

  it("includes the npm specifier when the resolved JSON is malformed", async () => {
    const { configDir } = setupNpmFixture({
      conventionsContent: "{ not json",
      packageJson: {
        exports: {
          "./konsistent": "./conventions.json",
        },
        name: "@scope/malformed-json",
        type: "module",
        version: "0.0.0",
      },
      packageName: "@scope/malformed-json",
    });

    const result = await resolveSources({
      configDir,
      conventionSources: { common: "@scope/malformed-json" },
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
        configDir: tmpDir,
        conventionSources: { common: "./local.json" },
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toContain("could not read file");
        expect(result.error).toContain("./local.json");
      }
    });

    it("routes an absolute path to the path-form branch", async () => {
      const result = await resolveSources({
        configDir: tmpDir,
        conventionSources: { common: "/abs/path.json" },
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
        configDir,
        conventionSources: { common: "@scope/pkg" },
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
        configDir,
        conventionSources: { common: "bare-pkg" },
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
        configDir,
        conventionSources: { common: "pkg/subpath" },
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
