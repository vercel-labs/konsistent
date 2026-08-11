import { describe, expect, it, vi } from "vitest";
import type { FileSystem } from "./filesystem.js";
import {
  createTargetedPathSelection,
  resolvePathSelectors,
} from "./path-selection.js";

function createMockFileSystem(opts: {
  files?: string[];
  directories?: string[];
  globResults?: Record<string, string[]>;
}): FileSystem {
  const files = new Set(opts.files ?? []);
  const directories = new Set(opts.directories ?? []);
  return {
    fileExists: (path) => files.has(path) || directories.has(path),
    glob: vi.fn((patterns: string[]) =>
      Promise.resolve(opts.globResults?.[patterns.join("\0")] ?? [])
    ),
    isDirectory: (path) => directories.has(path),
    isFile: (path) => files.has(path),
    readDir: () => [],
    readFile: () => "",
  };
}

describe("createTargetedPathSelection", () => {
  it("adds structural ancestors for selected files", () => {
    expect(
      createTargetedPathSelection({
        selectedPaths: ["components/Button/Button.test.tsx"],
      })
    ).toEqual({
      mode: "targeted",
      selectedPaths: ["components/Button/Button.test.tsx"],
      structuralPaths: [
        ".",
        "components",
        "components/Button",
        "components/Button/Button.test.tsx",
      ],
    });
  });
});

describe("resolvePathSelectors", () => {
  it("selects a concrete file without globbing", async () => {
    const fileSystem = createMockFileSystem({ files: ["src/index.ts"] });
    const selection = await resolvePathSelectors({
      selectors: ["src/index.ts"],
      cwd: "/repo",
      fileSystem,
    });

    expect(selection).toMatchObject({
      mode: "targeted",
      selectedPaths: ["src/index.ts"],
    });
    expect(fileSystem.glob).not.toHaveBeenCalled();
  });

  it("recursively expands a concrete directory from its bounded root", async () => {
    const fileSystem = createMockFileSystem({
      files: ["components/Button/Button.tsx"],
      directories: ["components/Button"],
      globResults: {
        "components/Button/**": ["components/Button/Button.tsx"],
      },
    });
    const selection = await resolvePathSelectors({
      selectors: ["components/Button"],
      cwd: "/repo",
      fileSystem,
    });

    expect(selection).toMatchObject({
      mode: "targeted",
      selectedPaths: ["components/Button", "components/Button/Button.tsx"],
    });
    expect(fileSystem.glob).toHaveBeenCalledWith(["components/Button/**"]);
  });

  it("resolves separate glob roots independently and de-duplicates matches", async () => {
    const fileSystem = createMockFileSystem({
      files: ["packages/a/index.ts", "src/index.ts"],
      globResults: {
        "packages/a/*.ts": ["packages/a/index.ts"],
        "src/*.ts": ["src/index.ts", "src/index.ts"],
      },
    });
    const selection = await resolvePathSelectors({
      selectors: ["packages/a/*.ts", "src/*.ts"],
      cwd: "/repo",
      fileSystem,
    });

    expect(selection).toMatchObject({
      mode: "targeted",
      selectedPaths: ["packages/a/index.ts", "src/index.ts"],
    });
    expect(fileSystem.glob).toHaveBeenNthCalledWith(1, ["packages/a/*.ts"]);
    expect(fileSystem.glob).toHaveBeenNthCalledWith(2, ["src/*.ts"]);
  });

  it("applies negative selectors to the bounded positive matches", async () => {
    const fileSystem = createMockFileSystem({
      files: ["components/Button/Button.tsx", "components/Input/Input.tsx"],
      globResults: {
        "components/**/*.tsx": [
          "components/Button/Button.tsx",
          "components/Input/Input.tsx",
        ],
      },
    });
    const selection = await resolvePathSelectors({
      selectors: ["components/**/*.tsx", "!components/Input"],
      cwd: "/repo",
      fileSystem,
    });

    expect(selection).toMatchObject({
      mode: "targeted",
      selectedPaths: ["components/Button/Button.tsx"],
    });
  });

  it("applies POSIX character classes in negative selectors", async () => {
    const fileSystem = createMockFileSystem({
      files: ["components/Button/Button.tsx", "components/Input/Input.tsx"],
      globResults: {
        "components/**/*.tsx": [
          "components/Button/Button.tsx",
          "components/Input/Input.tsx",
        ],
      },
    });
    const selection = await resolvePathSelectors({
      selectors: ["components/**/*.tsx", "!components/[!B]*/**"],
      cwd: "/repo",
      fileSystem,
    });

    expect(selection).toMatchObject({
      mode: "targeted",
      selectedPaths: ["components/Button/Button.tsx"],
    });
  });

  it("returns an explicit empty targeted selection", async () => {
    const selection = await resolvePathSelectors({
      selectors: ["missing/**/*.ts"],
      cwd: "/repo",
      fileSystem: createMockFileSystem({}),
    });

    expect(selection).toEqual({
      mode: "targeted",
      selectedPaths: [],
      structuralPaths: [],
    });
  });

  it("rejects selectors outside cwd and negative-only selections", async () => {
    const fileSystem = createMockFileSystem({});
    await expect(
      resolvePathSelectors({
        selectors: ["../outside/**/*.ts"],
        cwd: "/repo",
        fileSystem,
      })
    ).rejects.toThrow("must stay within the current directory");
    await expect(
      resolvePathSelectors({
        selectors: ["!src/**/*.ts"],
        cwd: "/repo",
        fileSystem,
      })
    ).rejects.toThrow("at least one positive path selector");
  });
});
