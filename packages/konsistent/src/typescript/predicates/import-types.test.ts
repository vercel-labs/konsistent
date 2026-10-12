import { describe, expect, it } from "vitest";
import type { PredicateContext } from "../../core/context.js";
import { parseFileStructure } from "../parser.js";
import type { FileStructure } from "../types.js";
import { checkImportTypes } from "./import-types.js";

function createMockContext(opts: {
  path: string;
  placeholders?: Record<string, { toString: () => string }>;
}): PredicateContext {
  const placeholders = opts.placeholders ?? {};
  return {
    directoryExists: () => false,
    fileExists: () => false,
    path: opts.path,
    placeholders: placeholders as PredicateContext["placeholders"],
    readDir: () => [],
    resolveTemplate(t: string): string {
      return t.replace(/\$\{(\w+)\}/g, (_match, name) => {
        const ph = placeholders[name];
        return ph ? ph.toString() : _match;
      });
    },
  };
}

function createMockFileStructure(opts: {
  imports?: FileStructure["imports"];
}): FileStructure {
  return {
    calls: [],
    classes: [],
    constants: [],
    declarationSymbols: [],
    defaultExportSymbols: [],
    exports: [],
    functions: [],
    importSources: [],
    imports: opts.imports ?? [],
    interfaces: [],
    namedExportSymbols: [],
    nonBarrelStatements: [],
    typeAliases: [],
  };
}

describe("checkImportTypes", () => {
  it("returns no diagnostics when type import is found", () => {
    const result = checkImportTypes({
      context: createMockContext({ path: "src/index.ts" }),
      expected: ["MyType"],
      fileStructure: createMockFileStructure({
        imports: [
          {
            from: "./types",
            isType: true,
            name: "MyType",
            pos: { column: 1, line: 1 },
          },
        ],
      }),
    });
    expect(result).toEqual([]);
  });

  it("returns diagnostic when type import is missing", () => {
    const result = checkImportTypes({
      context: createMockContext({ path: "src/index.ts" }),
      expected: ["MyType"],
      fileStructure: createMockFileStructure({ imports: [] }),
    });
    expect(result).toHaveLength(1);
    expect(result[0].message).toBe('Missing import type "MyType"');
    expect(result[0].predicateName).toBe("importTypes");
    expect(result[0].filePath).toBe("src/index.ts");
  });

  it("ignores non-type imports", () => {
    const result = checkImportTypes({
      context: createMockContext({ path: "src/index.ts" }),
      expected: ["MyType"],
      fileStructure: createMockFileStructure({
        imports: [
          {
            from: "./types",
            isType: false,
            name: "MyType",
            pos: { column: 1, line: 1 },
          },
        ],
      }),
    });
    expect(result).toHaveLength(1);
    expect(result[0].message).toBe('Missing import type "MyType"');
  });

  it("checks from constraint when specified", () => {
    const result = checkImportTypes({
      context: createMockContext({ path: "src/index.ts" }),
      expected: [{ from: "./correct-module", name: "MyType" }],
      fileStructure: createMockFileStructure({
        imports: [
          {
            from: "./correct-module",
            isType: true,
            name: "MyType",
            pos: { column: 1, line: 1 },
          },
        ],
      }),
    });
    expect(result).toEqual([]);
  });

  it("returns diagnostic when from does not match", () => {
    const result = checkImportTypes({
      context: createMockContext({ path: "src/index.ts" }),
      expected: [{ from: "./correct-module", name: "MyType" }],
      fileStructure: createMockFileStructure({
        imports: [
          {
            from: "./wrong-module",
            isType: true,
            name: "MyType",
            pos: { column: 1, line: 1 },
          },
        ],
      }),
    });
    expect(result).toHaveLength(1);
    expect(result[0].message).toBe('Missing import type "MyType"');
  });

  it("resolves template placeholders in name", () => {
    const result = checkImportTypes({
      context: createMockContext({
        path: "src/index.ts",
        placeholders: { name: { toString: () => "Button" } },
      }),
      expected: ["${name}Props"],
      fileStructure: createMockFileStructure({
        imports: [
          {
            from: "./types",
            isType: true,
            name: "ButtonProps",
            pos: { column: 1, line: 1 },
          },
        ],
      }),
    });
    expect(result).toEqual([]);
  });

  it("resolves template placeholders in from", () => {
    const result = checkImportTypes({
      context: createMockContext({
        path: "src/index.ts",
        placeholders: { name: { toString: () => "config" } },
      }),
      expected: [{ from: "./${name}", name: "Config" }],
      fileStructure: createMockFileStructure({
        imports: [
          {
            from: "./config",
            isType: true,
            name: "Config",
            pos: { column: 1, line: 1 },
          },
        ],
      }),
    });
    expect(result).toEqual([]);
  });

  it("accepts string shorthand without from constraint", () => {
    const result = checkImportTypes({
      context: createMockContext({ path: "src/index.ts" }),
      expected: ["MyType"],
      fileStructure: createMockFileStructure({
        imports: [
          {
            from: "./any-module",
            isType: true,
            name: "MyType",
            pos: { column: 1, line: 1 },
          },
        ],
      }),
    });
    expect(result).toEqual([]);
  });

  it("matches an aliased named type import by its original name", () => {
    const result = checkImportTypes({
      context: createMockContext({ path: "src/index.ts" }),
      expected: ["SourceType"],
      fileStructure: parseFileStructure({
        source: 'import type { SourceType as LocalType } from "pkg";',
      }),
    });
    expect(result).toEqual([]);
  });

  it("does not match an aliased named type import by only its local name", () => {
    const result = checkImportTypes({
      context: createMockContext({ path: "src/index.ts" }),
      expected: ["LocalType"],
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
        context,
        expected: [
          { alias: "LocalType", from: "type-package", name: "SourceType" },
        ],
        fileStructure: parseFileStructure({ source }),
      })
    ).toEqual([]);
    expect(
      checkImportTypes({
        context,
        expected: [{ alias: "OtherType", name: "SourceType" }],
        fileStructure: parseFileStructure({ source }),
      })[0].message
    ).toBe('Missing import type "SourceType" as "OtherType"');
  });

  it("allows an alias equal to the source name for a named type import", () => {
    const result = checkImportTypes({
      context: createMockContext({ path: "src/index.ts" }),
      expected: [{ alias: "SourceType", name: "SourceType" }],
      fileStructure: parseFileStructure({
        source: 'import type { SourceType } from "pkg";',
      }),
    });
    expect(result).toEqual([]);
  });

  it("resolves template placeholders in aliases", () => {
    const result = checkImportTypes({
      context: createMockContext({
        path: "src/index.ts",
        placeholders: { name: { toString: () => "Local" } },
      }),
      expected: [{ alias: "${name}Type", name: "SourceType" }],
      fileStructure: parseFileStructure({
        source: 'import type { SourceType as LocalType } from "pkg";',
      }),
    });
    expect(result).toEqual([]);
  });

  it.each([
    {
      expected: { alias: "DefaultType", name: "default" },
      source: 'import type DefaultType from "pkg";',
    },
    {
      expected: { alias: "NamespaceType", name: "*" },
      source: 'import type * as NamespaceType from "pkg";',
    },
    {
      expected: { alias: "DefaultType", name: "default" },
      source: 'import type { default as DefaultType } from "pkg";',
    },
  ])(
    "does not apply aliases to default or namespace type imports: $source",
    ({ source, expected }) => {
      const result = checkImportTypes({
        context: createMockContext({ path: "src/index.ts" }),
        expected: [expected],
        fileStructure: parseFileStructure({ source }),
      });
      expect(result).toHaveLength(1);
    }
  );

  it("includes conventionName when provided", () => {
    const result = checkImportTypes({
      context: createMockContext({ path: "src/index.ts" }),
      conventionName: "type-imports",
      expected: ["Missing"],
      fileStructure: createMockFileStructure({ imports: [] }),
    });
    expect(result[0].conventionName).toBe("type-imports");
  });
});
