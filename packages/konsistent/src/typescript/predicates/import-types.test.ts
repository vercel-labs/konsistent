import { describe, expect, it } from "vitest";
import type { PredicateContext } from "../../core/context.js";
import { parseFileStructure } from "../parser.js";
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
    declarationSymbols: [],
    defaultExportSymbols: [],
    importSources: [],
    namedExportSymbols: [],
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

  it("matches an aliased named type import by its original name", () => {
    const result = checkImportTypes({
      expected: ["SourceType"],
      context: createMockContext({ path: "src/index.ts" }),
      fileStructure: parseFileStructure({
        source: 'import type { SourceType as LocalType } from "pkg";',
      }),
    });
    expect(result).toEqual([]);
  });

  it("does not match an aliased named type import by only its local name", () => {
    const result = checkImportTypes({
      expected: ["LocalType"],
      context: createMockContext({ path: "src/index.ts" }),
      fileStructure: parseFileStructure({
        source: 'import type { SourceType as LocalType } from "pkg";',
      }),
    });
    expect(result[0].message).toBe('Missing import type "LocalType"');
  });

  it("requires an exact alias when configured", () => {
    const source =
      'import { type SourceType as LocalType } from "type-package";';
    const context = createMockContext({ path: "src/index.ts" });

    expect(
      checkImportTypes({
        expected: [
          { name: "SourceType", alias: "LocalType", from: "type-package" },
        ],
        context,
        fileStructure: parseFileStructure({ source }),
      })
    ).toEqual([]);
    expect(
      checkImportTypes({
        expected: [{ name: "SourceType", alias: "OtherType" }],
        context,
        fileStructure: parseFileStructure({ source }),
      })[0].message
    ).toBe('Missing import type "SourceType" as "OtherType"');
  });

  it("allows an alias equal to the source name for a named type import", () => {
    const result = checkImportTypes({
      expected: [{ name: "SourceType", alias: "SourceType" }],
      context: createMockContext({ path: "src/index.ts" }),
      fileStructure: parseFileStructure({
        source: 'import type { SourceType } from "pkg";',
      }),
    });
    expect(result).toEqual([]);
  });

  it("resolves template placeholders in aliases", () => {
    const result = checkImportTypes({
      expected: [{ name: "SourceType", alias: "${name}Type" }],
      context: createMockContext({
        path: "src/index.ts",
        placeholders: { name: { toString: () => "Local" } },
      }),
      fileStructure: parseFileStructure({
        source: 'import type { SourceType as LocalType } from "pkg";',
      }),
    });
    expect(result).toEqual([]);
  });

  it.each([
    {
      source: 'import type DefaultType from "pkg";',
      expected: { name: "default", alias: "DefaultType" },
    },
    {
      source: 'import type * as NamespaceType from "pkg";',
      expected: { name: "*", alias: "NamespaceType" },
    },
    {
      source: 'import type { default as DefaultType } from "pkg";',
      expected: { name: "default", alias: "DefaultType" },
    },
  ])("does not apply aliases to default or namespace type imports: $source", ({
    source,
    expected,
  }) => {
    const result = checkImportTypes({
      expected: [expected],
      context: createMockContext({ path: "src/index.ts" }),
      fileStructure: parseFileStructure({ source }),
    });
    expect(result).toHaveLength(1);
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
