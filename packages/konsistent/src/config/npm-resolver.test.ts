import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  classifySource,
  extractPackageName,
  findPackageDir,
  isPathInside,
  pathExists,
} from "./npm-resolver.js";

describe("classifySource", () => {
  it.each([
    { value: "", expected: "empty" },
    { value: "   ", expected: "empty" },
    { value: "./conventions.json", expected: "path" },
    { value: "../conventions.json", expected: "path" },
    { value: resolve("/tmp/conventions.json"), expected: "path" },
    { value: "@scope/conventions", expected: "npm" },
    { value: "conventions/subpath", expected: "npm" },
  ] as const)("classifies $value as $expected", ({ value, expected }) => {
    expect(classifySource(value)).toBe(expected);
  });
});

describe("isPathInside", () => {
  it("accepts the parent itself and descendants", () => {
    const parent = resolve("/tmp/package");

    expect(isPathInside({ child: parent, parent })).toBe(true);
    expect(
      isPathInside({ child: join(parent, "dist/conventions.json"), parent })
    ).toBe(true);
  });

  it("rejects siblings whose names share the parent prefix", () => {
    const parent = resolve("/tmp/package");

    expect(
      isPathInside({ child: resolve("/tmp/package-other/file.json"), parent })
    ).toBe(false);
  });
});

describe("npm package resolution", () => {
  it.each([
    { specifier: "package", expected: "package" },
    { specifier: "package/subpath", expected: "package" },
    { specifier: "@scope/package", expected: "@scope/package" },
    { specifier: "@scope/package/subpath", expected: "@scope/package" },
  ])("extracts $expected from $specifier", ({ specifier, expected }) => {
    expect(extractPackageName(specifier)).toBe(expected);
  });

  it("checks whether filesystem paths exist", async () => {
    await expect(pathExists(import.meta.filename)).resolves.toBe(true);
    await expect(
      pathExists(join(import.meta.dirname, "missing-package.json"))
    ).resolves.toBe(false);
  });

  it("finds installed packages by walking parent directories", async () => {
    await expect(
      findPackageDir({
        packageName: "zod",
        fromDir: join(import.meta.dirname, "nested/directory"),
      })
    ).resolves.toBe(resolve(import.meta.dirname, "../../node_modules/zod"));
  });

  it("returns null when a package is not installed", async () => {
    await expect(
      findPackageDir({
        packageName: "konsistent-definitely-missing-package",
        fromDir: import.meta.dirname,
      })
    ).resolves.toBeNull();
  });
});
