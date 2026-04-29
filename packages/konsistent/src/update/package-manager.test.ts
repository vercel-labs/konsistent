import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  detectPackageManager,
  getGlobalInstallCommand,
  getInstallCommand,
  isGlobalInstall,
  isMonorepo,
  isPackageInDeps,
  updatePackageJsonVersion,
} from "./package-manager.js";

let tmpDir: string;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "konsistent-pm-test-"));
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe("detectPackageManager", () => {
  it("detects bun via bun.lockb", () => {
    fs.writeFileSync(path.join(tmpDir, "bun.lockb"), "");
    expect(detectPackageManager(tmpDir)).toBe("bun");
  });

  it("detects bun via bun.lock", () => {
    fs.writeFileSync(path.join(tmpDir, "bun.lock"), "");
    expect(detectPackageManager(tmpDir)).toBe("bun");
  });

  it("detects pnpm via pnpm-lock.yaml", () => {
    fs.writeFileSync(path.join(tmpDir, "pnpm-lock.yaml"), "");
    expect(detectPackageManager(tmpDir)).toBe("pnpm");
  });

  it("detects yarn via yarn.lock", () => {
    fs.writeFileSync(path.join(tmpDir, "yarn.lock"), "");
    expect(detectPackageManager(tmpDir)).toBe("yarn");
  });

  it("detects npm via package-lock.json", () => {
    fs.writeFileSync(path.join(tmpDir, "package-lock.json"), "");
    expect(detectPackageManager(tmpDir)).toBe("npm");
  });

  it("reads packageManager field from package.json", () => {
    fs.writeFileSync(
      path.join(tmpDir, "package.json"),
      JSON.stringify({ packageManager: "pnpm@10.33.0" })
    );
    expect(detectPackageManager(tmpDir)).toBe("pnpm");
  });

  it("falls back to npm when nothing is found", () => {
    expect(detectPackageManager(tmpDir)).toBe("npm");
  });

  it("prioritizes lockfile over packageManager field", () => {
    fs.writeFileSync(path.join(tmpDir, "yarn.lock"), "");
    fs.writeFileSync(
      path.join(tmpDir, "package.json"),
      JSON.stringify({ packageManager: "pnpm@10.0.0" })
    );
    expect(detectPackageManager(tmpDir)).toBe("yarn");
  });
});

describe("isMonorepo", () => {
  it("detects pnpm workspace via pnpm-workspace.yaml", () => {
    fs.writeFileSync(
      path.join(tmpDir, "pnpm-workspace.yaml"),
      "packages:\n  - packages/*"
    );
    expect(isMonorepo(tmpDir)).toBe(true);
  });

  it("detects npm/yarn workspace via workspaces field", () => {
    fs.writeFileSync(
      path.join(tmpDir, "package.json"),
      JSON.stringify({ workspaces: ["packages/*"] })
    );
    expect(isMonorepo(tmpDir)).toBe(true);
  });

  it("returns false for non-monorepo", () => {
    fs.writeFileSync(
      path.join(tmpDir, "package.json"),
      JSON.stringify({ name: "my-app" })
    );
    expect(isMonorepo(tmpDir)).toBe(false);
  });

  it("returns false when no package.json and no workspace file", () => {
    expect(isMonorepo(tmpDir)).toBe(false);
  });
});

describe("getInstallCommand", () => {
  it("returns npm install command", () => {
    expect(
      getInstallCommand({
        packageManager: "npm",
        packageName: "konsistent",
        version: "1.0.0",
      })
    ).toEqual({ command: "npm", args: ["install", "konsistent@1.0.0"] });
  });

  it("returns pnpm add command", () => {
    expect(
      getInstallCommand({
        packageManager: "pnpm",
        packageName: "konsistent",
        version: "1.0.0",
      })
    ).toEqual({ command: "pnpm", args: ["add", "konsistent@1.0.0"] });
  });

  it("returns yarn add command", () => {
    expect(
      getInstallCommand({
        packageManager: "yarn",
        packageName: "konsistent",
        version: "1.0.0",
      })
    ).toEqual({ command: "yarn", args: ["add", "konsistent@1.0.0"] });
  });

  it("returns bun add command", () => {
    expect(
      getInstallCommand({
        packageManager: "bun",
        packageName: "konsistent",
        version: "1.0.0",
      })
    ).toEqual({ command: "bun", args: ["add", "konsistent@1.0.0"] });
  });

  it("adds -w flag for pnpm in workspace root", () => {
    expect(
      getInstallCommand({
        packageManager: "pnpm",
        packageName: "konsistent",
        version: "1.0.0",
        workspaceRoot: true,
      })
    ).toEqual({ command: "pnpm", args: ["add", "-w", "konsistent@1.0.0"] });
  });

  it("adds -W flag for yarn in workspace root", () => {
    expect(
      getInstallCommand({
        packageManager: "yarn",
        packageName: "konsistent",
        version: "1.0.0",
        workspaceRoot: true,
      })
    ).toEqual({ command: "yarn", args: ["add", "-W", "konsistent@1.0.0"] });
  });

  it("does not add workspace flag for npm or bun", () => {
    expect(
      getInstallCommand({
        packageManager: "npm",
        packageName: "konsistent",
        version: "1.0.0",
        workspaceRoot: true,
      })
    ).toEqual({ command: "npm", args: ["install", "konsistent@1.0.0"] });

    expect(
      getInstallCommand({
        packageManager: "bun",
        packageName: "konsistent",
        version: "1.0.0",
        workspaceRoot: true,
      })
    ).toEqual({ command: "bun", args: ["add", "konsistent@1.0.0"] });
  });
});

describe("getGlobalInstallCommand", () => {
  it("returns npm global install", () => {
    expect(
      getGlobalInstallCommand({
        packageManager: "npm",
        packageName: "konsistent",
        version: "1.0.0",
      })
    ).toEqual({ command: "npm", args: ["install", "-g", "konsistent@1.0.0"] });
  });

  it("returns yarn global add", () => {
    expect(
      getGlobalInstallCommand({
        packageManager: "yarn",
        packageName: "konsistent",
        version: "1.0.0",
      })
    ).toEqual({
      command: "yarn",
      args: ["global", "add", "konsistent@1.0.0"],
    });
  });

  it("returns bun add --global", () => {
    expect(
      getGlobalInstallCommand({
        packageManager: "bun",
        packageName: "konsistent",
        version: "1.0.0",
      })
    ).toEqual({
      command: "bun",
      args: ["add", "--global", "konsistent@1.0.0"],
    });
  });
});

describe("isGlobalInstall", () => {
  it("returns true when argv[1] is outside cwd node_modules", () => {
    const original = process.argv[1];
    process.argv[1] = "/usr/local/bin/konsistent";
    expect(isGlobalInstall()).toBe(true);
    process.argv[1] = original;
  });
});

describe("isPackageInDeps", () => {
  it("returns true when in dependencies", () => {
    fs.writeFileSync(
      path.join(tmpDir, "package.json"),
      JSON.stringify({ dependencies: { konsistent: "^1.0.0" } })
    );
    expect(isPackageInDeps({ cwd: tmpDir, packageName: "konsistent" })).toBe(
      true
    );
  });

  it("returns true when in devDependencies", () => {
    fs.writeFileSync(
      path.join(tmpDir, "package.json"),
      JSON.stringify({ devDependencies: { konsistent: "^1.0.0" } })
    );
    expect(isPackageInDeps({ cwd: tmpDir, packageName: "konsistent" })).toBe(
      true
    );
  });

  it("returns false when not in deps", () => {
    fs.writeFileSync(
      path.join(tmpDir, "package.json"),
      JSON.stringify({ dependencies: { other: "^1.0.0" } })
    );
    expect(isPackageInDeps({ cwd: tmpDir, packageName: "konsistent" })).toBe(
      false
    );
  });

  it("returns false when no package.json", () => {
    expect(isPackageInDeps({ cwd: tmpDir, packageName: "konsistent" })).toBe(
      false
    );
  });
});

describe("updatePackageJsonVersion", () => {
  it("updates version range when it does not satisfy new version", () => {
    const content = JSON.stringify(
      { devDependencies: { konsistent: "^0.0.1-alpha.4" } },
      null,
      2
    );
    fs.writeFileSync(path.join(tmpDir, "package.json"), content);

    const changed = updatePackageJsonVersion({
      cwd: tmpDir,
      packageName: "konsistent",
      newVersion: "0.0.2-alpha.1",
    });
    expect(changed).toBe(true);

    const updated = fs.readFileSync(path.join(tmpDir, "package.json"), "utf-8");
    expect(updated).toContain('"^0.0.2-alpha.1"');
  });

  it("does not update when range already satisfies", () => {
    const content = JSON.stringify(
      { devDependencies: { konsistent: "^0.0.1-alpha.4" } },
      null,
      2
    );
    fs.writeFileSync(path.join(tmpDir, "package.json"), content);

    const changed = updatePackageJsonVersion({
      cwd: tmpDir,
      packageName: "konsistent",
      newVersion: "0.0.1-alpha.5",
    });
    expect(changed).toBe(false);
  });

  it("preserves indentation", () => {
    const content =
      '{\n\t"devDependencies": {\n\t\t"konsistent": "^1.0.0"\n\t}\n}\n';
    fs.writeFileSync(path.join(tmpDir, "package.json"), content);

    updatePackageJsonVersion({
      cwd: tmpDir,
      packageName: "konsistent",
      newVersion: "2.0.0",
    });

    const updated = fs.readFileSync(path.join(tmpDir, "package.json"), "utf-8");
    expect(updated).toContain('\t"konsistent": "^2.0.0"');
  });

  it("returns false when package is not in deps", () => {
    fs.writeFileSync(
      path.join(tmpDir, "package.json"),
      JSON.stringify({ dependencies: {} })
    );

    const changed = updatePackageJsonVersion({
      cwd: tmpDir,
      packageName: "konsistent",
      newVersion: "2.0.0",
    });
    expect(changed).toBe(false);
  });
});
