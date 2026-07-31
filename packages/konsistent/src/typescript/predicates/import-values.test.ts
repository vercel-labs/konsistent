import { describe, expect, it } from "vitest";
import type { PredicateContext } from "../../core/context.js";
import { parseFileStructure } from "../parser.js";
import type { FileStructure } from "../types.js";
import { checkImportValues } from "./import-values.js";

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

describe("checkImportValues", () => {
  it("returns no diagnostics when import is found", () => {
    const result = checkImportValues({
      expected: ["useState"],
      context: createMockContext({ path: "src/index.ts" }),
      fileStructure: createMockFileStructure({
        imports: [
          {
            name: "useState",
            from: "react",
            isType: false,
            pos: { line: 1, column: 1 },
          },
        ],
      }),
    });
    expect(result).toEqual([]);
  });

  it("returns diagnostic when import is missing", () => {
    const result = checkImportValues({
      expected: ["useState"],
      context: createMockContext({ path: "src/index.ts" }),
      fileStructure: createMockFileStructure({ imports: [] }),
    });
    expect(result).toHaveLength(1);
    expect(result[0].message).toBe('Missing import "useState"');
    expect(result[0].predicateName).toBe("importValues");
    expect(result[0].filePath).toBe("src/index.ts");
  });

  it("ignores type imports", () => {
    const result = checkImportValues({
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
    expect(result).toHaveLength(1);
    expect(result[0].message).toBe('Missing import "MyType"');
  });

  it("returns diagnostic when from does not match", () => {
    const result = checkImportValues({
      expected: [{ name: "useState", from: "react" }],
      context: createMockContext({ path: "src/index.ts" }),
      fileStructure: createMockFileStructure({
        imports: [
          {
            name: "useState",
            from: "preact",
            isType: false,
            pos: { line: 1, column: 1 },
          },
        ],
      }),
    });
    expect(result).toHaveLength(1);
    expect(result[0].message).toBe('Missing import "useState"');
  });

  it("checks from constraint when specified", () => {
    const result = checkImportValues({
      expected: [{ name: "useState", from: "react" }],
      context: createMockContext({ path: "src/index.ts" }),
      fileStructure: createMockFileStructure({
        imports: [
          {
            name: "useState",
            from: "react",
            isType: false,
            pos: { line: 1, column: 1 },
          },
        ],
      }),
    });
    expect(result).toEqual([]);
  });

  it("resolves template placeholders in name", () => {
    const result = checkImportValues({
      expected: ["use${name}"],
      context: createMockContext({
        path: "src/index.ts",
        placeholders: { name: { toString: () => "State" } },
      }),
      fileStructure: createMockFileStructure({
        imports: [
          {
            name: "useState",
            from: "react",
            isType: false,
            pos: { line: 1, column: 1 },
          },
        ],
      }),
    });
    expect(result).toEqual([]);
  });

  it("resolves template placeholders in from", () => {
    const result = checkImportValues({
      expected: [{ name: "helper", from: "./${name}" }],
      context: createMockContext({
        path: "src/index.ts",
        placeholders: { name: { toString: () => "utils" } },
      }),
      fileStructure: createMockFileStructure({
        imports: [
          {
            name: "helper",
            from: "./utils",
            isType: false,
            pos: { line: 1, column: 1 },
          },
        ],
      }),
    });
    expect(result).toEqual([]);
  });

  it("accepts string shorthand without from constraint", () => {
    const result = checkImportValues({
      expected: ["useState"],
      context: createMockContext({ path: "src/index.ts" }),
      fileStructure: createMockFileStructure({
        imports: [
          {
            name: "useState",
            from: "any-package",
            isType: false,
            pos: { line: 1, column: 1 },
          },
        ],
      }),
    });
    expect(result).toEqual([]);
  });

  it("matches an aliased named import by its original name", () => {
    const result = checkImportValues({
      expected: ["sourceValue"],
      context: createMockContext({ path: "src/index.ts" }),
      fileStructure: parseFileStructure({
        source: 'import { sourceValue as localValue } from "pkg";',
      }),
    });
    expect(result).toEqual([]);
  });

  it("does not match an aliased named import by only its local name", () => {
    const result = checkImportValues({
      expected: ["localValue"],
      context: createMockContext({ path: "src/index.ts" }),
      fileStructure: parseFileStructure({
        source: 'import { sourceValue as localValue } from "pkg";',
      }),
    });
    expect(result[0].message).toBe('Missing import "localValue"');
  });

  it("preserves local-name matching for the deprecated import predicate", () => {
    const result = checkImportValues({
      expected: ["localValue"],
      predicateName: "import",
      context: createMockContext({ path: "src/index.ts" }),
      fileStructure: parseFileStructure({
        source: 'import { sourceValue as localValue } from "pkg";',
      }),
    });
    expect(result).toEqual([]);
  });

  it("requires an exact alias when configured", () => {
    const source = 'import { sourceValue as localValue } from "pkg";';
    const context = createMockContext({ path: "src/index.ts" });

    expect(
      checkImportValues({
        expected: [{ name: "sourceValue", alias: "localValue", from: "pkg" }],
        context,
        fileStructure: parseFileStructure({ source }),
      })
    ).toEqual([]);
    expect(
      checkImportValues({
        expected: [{ name: "sourceValue", alias: "otherValue" }],
        context,
        fileStructure: parseFileStructure({ source }),
      })[0].message
    ).toBe('Missing import "sourceValue" as "otherValue"');
  });

  it("allows an alias equal to the source name for a named import", () => {
    const result = checkImportValues({
      expected: [{ name: "sourceValue", alias: "sourceValue" }],
      context: createMockContext({ path: "src/index.ts" }),
      fileStructure: parseFileStructure({
        source: 'import { sourceValue } from "pkg";',
      }),
    });
    expect(result).toEqual([]);
  });

  it("resolves template placeholders in aliases", () => {
    const result = checkImportValues({
      expected: [{ name: "sourceValue", alias: "${name}Value" }],
      context: createMockContext({
        path: "src/index.ts",
        placeholders: { name: { toString: () => "local" } },
      }),
      fileStructure: parseFileStructure({
        source: 'import { sourceValue as localValue } from "pkg";',
      }),
    });
    expect(result).toEqual([]);
  });

  it.each([
    {
      source: 'import DefaultValue from "pkg";',
      expected: { name: "default", alias: "DefaultValue" },
    },
    {
      source: 'import * as NamespaceValue from "pkg";',
      expected: { name: "*", alias: "NamespaceValue" },
    },
    {
      source: 'import { default as DefaultValue } from "pkg";',
      expected: { name: "default", alias: "DefaultValue" },
    },
  ])("does not apply aliases to default or namespace imports: $source", ({
    source,
    expected,
  }) => {
    const result = checkImportValues({
      expected: [expected],
      context: createMockContext({ path: "src/index.ts" }),
      fileStructure: parseFileStructure({ source }),
    });
    expect(result).toHaveLength(1);
  });

  it("preserves alias-less matching for default and namespace imports", () => {
    const fileStructure = parseFileStructure({
      source: [
        'import DefaultValue from "default-pkg";',
        'import * as NamespaceValue from "namespace-pkg";',
        'import { default as NamedDefault } from "named-default-pkg";',
      ].join("\n"),
    });
    const result = checkImportValues({
      expected: ["DefaultValue", "NamespaceValue", "NamedDefault"],
      context: createMockContext({ path: "src/index.ts" }),
      fileStructure,
    });
    expect(result).toEqual([]);
  });

  it("includes conventionName when provided", () => {
    const result = checkImportValues({
      expected: ["Missing"],
      context: createMockContext({ path: "src/index.ts" }),
      fileStructure: createMockFileStructure({ imports: [] }),
      conventionName: "regular-imports",
    });
    expect(result[0].conventionName).toBe("regular-imports");
  });
});
