import { describe, expect, it } from "vitest";
import {
  resolveCommandInvocation,
  validatePublishedPackages,
} from "./verify-package.mjs";

function createManifests() {
  return {
    cliManifest: {
      bin: { konsistent: "./dist/cli.js" },
      dependencies: {
        "@konsistent/convention": "1.0.0-beta.12",
        typescript: "7.0.2",
      },
      engines: { node: "^22.18.0 || ^24.11.0 || >=26.0.0" },
    },
    conventionManifest: {
      bin: { "konsistent-convention": "./dist/cli.js" },
      dependencies: { citty: "^0.2" },
      exports: {
        ".": { import: "./dist/index.js", types: "./dist/index.d.ts" },
      },
      peerDependencies: { zod: "^4" },
    },
    typescriptVersion: "7.0.2",
  };
}

describe("packed package contracts", () => {
  it("runs Windows executables directly even when their paths contain spaces", () => {
    const command = "C:\\Program Files\\nodejs\\node.exe";
    const args = ["C:\\Temporary Files\\konsistent\\cli.js", "--version"];
    expect(
      resolveCommandInvocation({ args, command, platform: "win32" })
    ).toEqual({ args, command, shell: false });
  });

  it.each(["npm", "pnpm"])(
    "runs the Windows %s command through a shell with quoted paths",
    (command) => {
      expect(
        resolveCommandInvocation({
          args: ["pack", "C:\\Temporary Files\\package.tgz"],
          command,
          platform: "win32",
        })
      ).toEqual({
        args: ['"pack"', '"C:\\Temporary Files\\package.tgz"'],
        command,
        shell: true,
      });
    }
  );

  it("runs Unix package-manager commands without a shell", () => {
    expect(
      resolveCommandInvocation({
        args: ["pack"],
        command: "pnpm",
        platform: "linux",
      })
    ).toEqual({ args: ["pack"], command: "pnpm", shell: false });
  });

  it("accepts exact compiler pins and preserved package entrypoints", () => {
    expect(() => validatePublishedPackages(createManifests())).not.toThrow();
  });

  it("rejects a compiler range or legacy compiler", () => {
    for (const version of ["^7.0.2", "5.9.3"]) {
      const manifests = createManifests();
      manifests.cliManifest.dependencies.typescript = version;
      expect(() => validatePublishedPackages(manifests)).toThrow();
    }
  });

  it("rejects the superseded Node.js requirement", () => {
    const manifests = createManifests();
    manifests.cliManifest.engines.node = ">=22.11.0";
    expect(() => validatePublishedPackages(manifests)).toThrow();
  });

  it("rejects unresolved workspace and catalog protocols", () => {
    for (const version of ["workspace:*", "catalog:"]) {
      const manifests = createManifests();
      manifests.conventionManifest.peerDependencies.zod = version;
      expect(() => validatePublishedPackages(manifests)).toThrow();
    }
  });
});
