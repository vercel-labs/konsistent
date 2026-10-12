import { describe, expect, it } from "vitest";
import type { PredicateContext } from "../core/context.js";
import type { FileSystem } from "../core/filesystem.js";
import { checkHaveType } from "./have-type.js";

function createMockContext(opts: { path: string }): PredicateContext {
  return {
    directoryExists: () => false,
    fileExists: () => false,
    path: opts.path,
    placeholders: {},
    readDir: () => [],
    resolveTemplate: (t: string) => t,
  };
}

function createMockFileSystem(opts: {
  files?: Set<string>;
  directories?: Set<string>;
}): FileSystem {
  const files = opts.files ?? new Set<string>();
  const directories = opts.directories ?? new Set<string>();
  return {
    directoryExists: (p: string) => directories.has(p),
    fileExists: (p: string) => files.has(p) || directories.has(p),
    glob: async () => [],
    isDirectory: (p: string) => directories.has(p),
    isFile: (p: string) => files.has(p),
    readDir: () => [],
    readFile: () => "",
  };
}

describe("checkHaveType", () => {
  it("returns no diagnostics when file matches expected type 'file'", () => {
    const result = checkHaveType({
      context: createMockContext({ path: "src/index.ts" }),
      expected: "file",
      fileSystem: createMockFileSystem({ files: new Set(["src/index.ts"]) }),
    });
    expect(result).toEqual([]);
  });

  it("returns no diagnostics when directory matches expected type 'directory'", () => {
    const result = checkHaveType({
      context: createMockContext({ path: "src" }),
      expected: "directory",
      fileSystem: createMockFileSystem({ directories: new Set(["src"]) }),
    });
    expect(result).toEqual([]);
  });

  it("returns diagnostic when expected file but found directory", () => {
    const result = checkHaveType({
      context: createMockContext({ path: "src" }),
      expected: "file",
      fileSystem: createMockFileSystem({ directories: new Set(["src"]) }),
    });
    expect(result).toHaveLength(1);
    expect(result[0].message).toBe("Expected a file but found a directory");
    expect(result[0].predicateName).toBe("haveType");
  });

  it("returns diagnostic when expected directory but found file", () => {
    const result = checkHaveType({
      context: createMockContext({ path: "src/index.ts" }),
      expected: "directory",
      fileSystem: createMockFileSystem({ files: new Set(["src/index.ts"]) }),
    });
    expect(result).toHaveLength(1);
    expect(result[0].message).toBe("Expected a directory but found a file");
  });

  it("returns diagnostic when path does not exist (expected file)", () => {
    const result = checkHaveType({
      context: createMockContext({ path: "missing.ts" }),
      expected: "file",
      fileSystem: createMockFileSystem({}),
    });
    expect(result).toHaveLength(1);
    expect(result[0].message).toBe("Expected a file but path does not exist");
  });

  it("returns diagnostic when path does not exist (expected directory)", () => {
    const result = checkHaveType({
      context: createMockContext({ path: "missing" }),
      expected: "directory",
      fileSystem: createMockFileSystem({}),
    });
    expect(result).toHaveLength(1);
    expect(result[0].message).toBe(
      "Expected a directory but path does not exist"
    );
  });

  it("includes conventionName when provided", () => {
    const result = checkHaveType({
      context: createMockContext({ path: "missing.ts" }),
      conventionName: "test-convention",
      expected: "file",
      fileSystem: createMockFileSystem({}),
    });
    expect(result[0].conventionName).toBe("test-convention");
  });
});
