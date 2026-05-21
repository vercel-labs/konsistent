import { describe, expect, it } from "vitest";
import type { PredicateContext } from "../../core/context.js";
import type { FileStructure } from "../types.js";
import { checkImportTypes } from "./import-types.js";

function createMockContext(opts: {
  path: string;
  placeholders?: Record<string, { toString(): string }>;
}): PredicateContext {
  const placeholders = opts.placeholders ?? {};
  return {
    path: opts.path,
    placeholders: placeholders as PredicateContext["placeholders"],
    resolveTemplate(t: string): string {
      return t.replace(/\$\{(\w+)\}/g, (_match, name) => {
        const ph = placeholders[name];
        return ph ? ph.toString() : _match;
      });
    },
    fileExists: () => false,
    readDir: () => [],
  };
}

function createMockFileStructure(opts: {
  imports?: FileStructure["imports"];
}): FileStructure {
  return {
    exports: [],
    imports: opts.imports ?? [],
    interfaces: [],
    classes: [],
    functions: [],
    constants: [],
    nonBarrelStatements: [],
    typeAliases: [],
  };
}

describe("checkImportTypes", () => {
  it("returns no diagnostics when type import is found", () => {
    const result = checkImportTypes({
      expected: ["MyType"],
      context: createMockContext({ path: "src/index.ts" }),
      fileStructure: createMockFileStructure({
        imports: [
          {
            name: "MyType",
            from: "./types",
            isType: true,
            pos: { line: 1, column: 1 },
          },
        ],
      }),
    });
    expect(result).toEqual([]);
  });

  it("returns diagnostic when type import is missing", () => {
    const result = checkImportTypes({
      expected: ["MyType"],
      context: createMockContext({ path: "src/index.ts" }),
      fileStructure: createMockFileStructure({ imports: [] }),
    });
    expect(result).toHaveLength(1);
    expect(result[0].message).toBe('Missing import type "MyType"');
    expect(result[0].predicateName).toBe("importTypes");
    expect(result[0].filePath).toBe("src/index.ts");
  });

  it("ignores non-type imports", () => {
    const result = checkImportTypes({
      expected: ["MyType"],
      context: createMockContext({ path: "src/index.ts" }),
      fileStructure: createMockFileStructure({
        imports: [
          {
            name: "MyType",
            from: "./types",
            isType: false,
            pos: { line: 1, column: 1 },
          },
        ],
      }),
    });
    expect(result).toHaveLength(1);
    expect(result[0].message).toBe('Missing import type "MyType"');
  });

  it("checks from constraint when specified", () => {
    const result = checkImportTypes({
      expected: [{ name: "MyType", from: "./correct-module" }],
      context: createMockContext({ path: "src/index.ts" }),
      fileStructure: createMockFileStructure({
        imports: [
          {
            name: "MyType",
            from: "./correct-module",
            isType: true,
            pos: { line: 1, column: 1 },
          },
        ],
      }),
    });
    expect(result).toEqual([]);
  });

  it("returns diagnostic when from does not match", () => {
    const result = checkImportTypes({
      expected: [{ name: "MyType", from: "./correct-module" }],
      context: createMockContext({ path: "src/index.ts" }),
      fileStructure: createMockFileStructure({
        imports: [
          {
            name: "MyType",
            from: "./wrong-module",
            isType: true,
            pos: { line: 1, column: 1 },
          },
        ],
      }),
    });
    expect(result).toHaveLength(1);
    expect(result[0].message).toBe('Missing import type "MyType"');
  });

  it("resolves template placeholders in name", () => {
    const result = checkImportTypes({
      expected: ["${name}Props"],
      context: createMockContext({
        path: "src/index.ts",
        placeholders: { name: { toString: () => "Button" } },
      }),
      fileStructure: createMockFileStructure({
        imports: [
          {
            name: "ButtonProps",
            from: "./types",
            isType: true,
            pos: { line: 1, column: 1 },
          },
        ],
      }),
    });
    expect(result).toEqual([]);
  });

  it("resolves template placeholders in from", () => {
    const result = checkImportTypes({
      expected: [{ name: "Config", from: "./${name}" }],
      context: createMockContext({
        path: "src/index.ts",
        placeholders: { name: { toString: () => "config" } },
      }),
      fileStructure: createMockFileStructure({
        imports: [
          {
            name: "Config",
            from: "./config",
            isType: true,
            pos: { line: 1, column: 1 },
          },
        ],
      }),
    });
    expect(result).toEqual([]);
  });

  it("accepts string shorthand without from constraint", () => {
    const result = checkImportTypes({
      expected: ["MyType"],
      context: createMockContext({ path: "src/index.ts" }),
      fileStructure: createMockFileStructure({
        imports: [
          {
            name: "MyType",
            from: "./any-module",
            isType: true,
            pos: { line: 1, column: 1 },
          },
        ],
      }),
    });
    expect(result).toEqual([]);
  });

  it("includes conventionName when provided", () => {
    const result = checkImportTypes({
      expected: ["Missing"],
      context: createMockContext({ path: "src/index.ts" }),
      fileStructure: createMockFileStructure({ imports: [] }),
      conventionName: "type-imports",
    });
    expect(result[0].conventionName).toBe("type-imports");
  });
});
