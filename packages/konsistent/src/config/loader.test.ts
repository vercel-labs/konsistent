import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { loadConfig } from "./loader.js";

const fixturesDir = resolve(import.meta.dirname, "../../../../e2e/fixtures");

describe("loadConfig", () => {
  it("loads a valid empty-config fixture", async () => {
    const result = await loadConfig({
      configPath: resolve(fixturesDir, "empty-config/konsistent.json"),
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.config.version).toBe("v1");
      expect(result.config.conventions).toEqual([]);
    }
  });

  it("returns error for invalid-config fixture", async () => {
    const result = await loadConfig({
      configPath: resolve(fixturesDir, "invalid-config/konsistent.json"),
    });
    expect(result.success).toBe(false);
  });

  it("returns error when config file does not exist", async () => {
    const result = await loadConfig({
      configPath: "/nonexistent/path/konsistent.json",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toContain("Could not read config file");
    }
  });

  it("returns error for invalid JSON", async () => {
    const result = await loadConfig({
      configPath: resolve(import.meta.dirname, "schema.ts"),
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toContain("Invalid JSON");
    }
  });
});

describe("loadConfig --config-package", () => {
  let tmpDir: string;
  let consumerDir: string;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), "konsistent-loader-package-"));
    consumerDir = join(tmpDir, "consumer");
    mkdirSync(consumerDir, { recursive: true });
    vi.spyOn(process, "cwd").mockReturnValue(consumerDir);
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
    vi.restoreAllMocks();
  });

  function setupPackage(opts: {
    packageName: string;
    packageJson?: Record<string, unknown>;
    configAtRoot?: boolean;
    configAtDist?: boolean;
    configAtCustomPath?: string;
  }): string {
    const {
      packageName,
      packageJson,
      configAtRoot,
      configAtDist,
      configAtCustomPath,
    } = opts;

    const pkgDir = join(consumerDir, "node_modules", ...packageName.split("/"));
    mkdirSync(pkgDir, { recursive: true });

    writeFileSync(
      join(pkgDir, "package.json"),
      JSON.stringify(
        packageJson ?? { name: packageName, version: "0.0.0", type: "module" }
      )
    );

    const validConfig = JSON.stringify({
      version: "v1",
      conventions: [],
    });

    if (configAtRoot) {
      writeFileSync(join(pkgDir, "konsistent.json"), validConfig);
    }
    if (configAtDist) {
      mkdirSync(join(pkgDir, "dist"), { recursive: true });
      writeFileSync(join(pkgDir, "dist", "konsistent.json"), validConfig);
    }
    if (configAtCustomPath !== undefined) {
      const target = join(pkgDir, configAtCustomPath);
      mkdirSync(join(target, ".."), { recursive: true });
      writeFileSync(target, validConfig);
    }

    return pkgDir;
  }

  it("loads konsistent.json from the package root", async () => {
    setupPackage({ packageName: "@scope/root-config", configAtRoot: true });

    const result = await loadConfig({ configPackage: "@scope/root-config" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.config.version).toBe("v1");
    }
  });

  it("loads konsistent.json from the dist folder", async () => {
    setupPackage({ packageName: "@scope/dist-config", configAtDist: true });

    const result = await loadConfig({ configPackage: "@scope/dist-config" });
    expect(result.success).toBe(true);
  });

  it("prefers dist/ over root when both are present", async () => {
    const pkgDir = setupPackage({
      packageName: "@scope/both",
      configAtRoot: true,
      configAtDist: true,
    });

    writeFileSync(
      join(pkgDir, "konsistent.json"),
      JSON.stringify({ version: "v1", conventions: [] })
    );
    writeFileSync(
      join(pkgDir, "dist", "konsistent.json"),
      JSON.stringify({
        version: "v1",
        conventions: [
          {
            name: "from-dist",
            description: "Loaded from dist.",
            paths: "src/*.ts",
            must: { haveType: "file" },
          },
        ],
      })
    );

    const result = await loadConfig({ configPackage: "@scope/both" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.config.conventions).toHaveLength(1);
      expect(result.config.conventions[0].name).toBe("from-dist");
    }
  });

  it('respects an explicit package.json "konsistent" field', async () => {
    setupPackage({
      packageName: "@scope/explicit-field",
      packageJson: {
        name: "@scope/explicit-field",
        version: "0.0.0",
        type: "module",
        konsistent: "./build/my-config.json",
      },
      configAtCustomPath: "build/my-config.json",
    });

    const result = await loadConfig({
      configPackage: "@scope/explicit-field",
    });
    expect(result.success).toBe(true);
  });

  it("errors when the package is not installed", async () => {
    const result = await loadConfig({
      configPackage: "@konsistent-test/definitely-not-installed",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toContain(
        "@konsistent-test/definitely-not-installed"
      );
      expect(result.error).toContain("not installed");
    }
  });

  it("errors when the package contains no konsistent.json", async () => {
    setupPackage({ packageName: "@scope/no-config" });

    const result = await loadConfig({ configPackage: "@scope/no-config" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toContain("no konsistent.json found");
      expect(result.error).toContain("dist/konsistent.json");
      expect(result.error).toContain("/konsistent.json");
    }
  });

  it("errors when both --config-path and --config-package are passed", async () => {
    const result = await loadConfig({
      configPath: "/some/path/konsistent.json",
      configPackage: "@scope/some-pkg",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toContain("--config-path");
      expect(result.error).toContain("--config-package");
    }
  });

  it("rejects path-form values", async () => {
    const result = await loadConfig({ configPackage: "./local-config" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toContain("looks like a filesystem path");
      expect(result.error).toContain("--config-path");
    }
  });

  it("rejects absolute-path values", async () => {
    const result = await loadConfig({ configPackage: "/abs/path" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toContain("looks like a filesystem path");
    }
  });

  it("rejects empty values", async () => {
    const result = await loadConfig({ configPackage: "" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toContain("empty");
    }
  });

  it("rejects bare-package values with a subpath", async () => {
    const result = await loadConfig({ configPackage: "lodash/fp" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toContain("subpath");
      expect(result.error).toContain('"lodash"');
    }
  });

  it("rejects scoped-package values with a subpath", async () => {
    const result = await loadConfig({ configPackage: "@scope/pkg/sub" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toContain("subpath");
      expect(result.error).toContain('"@scope/pkg"');
    }
  });
});
