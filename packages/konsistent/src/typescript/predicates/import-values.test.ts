import { describe, expect, it } from "vitest";
import type { PredicateContext } from "../../core/context.js";
import { parseFileStructure } from "../parser.js";
import type { FileStructure } from "../types.js";
import { checkImportValues } from "./import-values.js";

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

describe("checkImportValues", () => {
  it("returns no diagnostics when import is found", () => {
    const result = checkImportValues({
      context: createMockContext({ path: "src/index.ts" }),
      expected: ["useState"],
      fileStructure: createMockFileStructure({
        imports: [
          {
            from: "react",
            isType: false,
            name: "useState",
            pos: { column: 1, line: 1 },
          },
        ],
      }),
    });
    expect(result).toEqual([]);
  });

  it("returns diagnostic when import is missing", () => {
    const result = checkImportValues({
      context: createMockContext({ path: "src/index.ts" }),
      expected: ["useState"],
      fileStructure: createMockFileStructure({ imports: [] }),
    });
    expect(result).toHaveLength(1);
    expect(result[0].message).toBe('Missing import "useState"');
    expect(result[0].predicateName).toBe("importValues");
    expect(result[0].filePath).toBe("src/index.ts");
  });

  it("ignores type imports", () => {
    const result = checkImportValues({
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
    expect(result).toHaveLength(1);
    expect(result[0].message).toBe('Missing import "MyType"');
  });

  it("returns diagnostic when from does not match", () => {
    const result = checkImportValues({
      context: createMockContext({ path: "src/index.ts" }),
      expected: [{ from: "react", name: "useState" }],
      fileStructure: createMockFileStructure({
        imports: [
          {
            from: "preact",
            isType: false,
            name: "useState",
            pos: { column: 1, line: 1 },
          },
        ],
      }),
    });
    expect(result).toHaveLength(1);
    expect(result[0].message).toBe('Missing import "useState"');
  });

  it("checks from constraint when specified", () => {
    const result = checkImportValues({
      context: createMockContext({ path: "src/index.ts" }),
      expected: [{ from: "react", name: "useState" }],
      fileStructure: createMockFileStructure({
        imports: [
          {
            from: "react",
            isType: false,
            name: "useState",
            pos: { column: 1, line: 1 },
          },
        ],
      }),
    });
    expect(result).toEqual([]);
  });

  it("resolves template placeholders in name", () => {
    const result = checkImportValues({
      context: createMockContext({
        path: "src/index.ts",
        placeholders: { name: { toString: () => "State" } },
      }),
      expected: ["use${name}"],
      fileStructure: createMockFileStructure({
        imports: [
          {
            from: "react",
            isType: false,
            name: "useState",
            pos: { column: 1, line: 1 },
          },
        ],
      }),
    });
    expect(result).toEqual([]);
  });

  it("resolves template placeholders in from", () => {
    const result = checkImportValues({
      context: createMockContext({
        path: "src/index.ts",
        placeholders: { name: { toString: () => "utils" } },
      }),
      expected: [{ from: "./${name}", name: "helper" }],
      fileStructure: createMockFileStructure({
        imports: [
          {
            from: "./utils",
            isType: false,
            name: "helper",
            pos: { column: 1, line: 1 },
          },
        ],
      }),
    });
    expect(result).toEqual([]);
  });

  it("accepts string shorthand without from constraint", () => {
    const result = checkImportValues({
      context: createMockContext({ path: "src/index.ts" }),
      expected: ["useState"],
      fileStructure: createMockFileStructure({
        imports: [
          {
            from: "any-package",
            isType: false,
            name: "useState",
            pos: { column: 1, line: 1 },
          },
        ],
      }),
    });
    expect(result).toEqual([]);
  });

  it("matches an aliased named import by its original name", () => {
    const result = checkImportValues({
      context: createMockContext({ path: "src/index.ts" }),
      expected: ["sourceValue"],
      fileStructure: parseFileStructure({
        source: 'import { sourceValue as localValue } from "pkg";',
      }),
    });
    expect(result).toEqual([]);
  });

  it("does not match an aliased named import by only its local name", () => {
    const result = checkImportValues({
      context: createMockContext({ path: "src/index.ts" }),
      expected: ["localValue"],
      fileStructure: parseFileStructure({
        source: 'import { sourceValue as localValue } from "pkg";',
      }),
    });
    expect(result[0].message).toBe('Missing import "localValue"');
  });

  it("preserves local-name matching for the deprecated import predicate", () => {
    const result = checkImportValues({
      context: createMockContext({ path: "src/index.ts" }),
      expected: ["localValue"],
      fileStructure: parseFileStructure({
        source: 'import { sourceValue as localValue } from "pkg";',
      }),
      predicateName: "import",
    });
    expect(result).toEqual([]);
  });

  it("requires an exact alias when configured", () => {
    const source = 'import { sourceValue as localValue } from "pkg";';
    const context = createMockContext({ path: "src/index.ts" });

    expect(
      checkImportValues({
        context,
        expected: [{ alias: "localValue", from: "pkg", name: "sourceValue" }],
        fileStructure: parseFileStructure({ source }),
      })
    ).toEqual([]);
    expect(
      checkImportValues({
        context,
        expected: [{ alias: "otherValue", name: "sourceValue" }],
        fileStructure: parseFileStructure({ source }),
      })[0].message
    ).toBe('Missing import "sourceValue" as "otherValue"');
  });

  it("allows an alias equal to the source name for a named import", () => {
    const result = checkImportValues({
      context: createMockContext({ path: "src/index.ts" }),
      expected: [{ alias: "sourceValue", name: "sourceValue" }],
      fileStructure: parseFileStructure({
        source: 'import { sourceValue } from "pkg";',
      }),
    });
    expect(result).toEqual([]);
  });

  it("resolves template placeholders in aliases", () => {
    const result = checkImportValues({
      context: createMockContext({
        path: "src/index.ts",
        placeholders: { name: { toString: () => "local" } },
      }),
      expected: [{ alias: "${name}Value", name: "sourceValue" }],
      fileStructure: parseFileStructure({
        source: 'import { sourceValue as localValue } from "pkg";',
      }),
    });
    expect(result).toEqual([]);
  });

  it.each([
    {
      expected: { alias: "DefaultValue", name: "default" },
      source: 'import DefaultValue from "pkg";',
    },
    {
      expected: { alias: "NamespaceValue", name: "*" },
      source: 'import * as NamespaceValue from "pkg";',
    },
    {
      expected: { alias: "DefaultValue", name: "default" },
      source: 'import { default as DefaultValue } from "pkg";',
    },
  ])(
    "does not apply aliases to default or namespace imports: $source",
    ({ source, expected }) => {
      const result = checkImportValues({
        context: createMockContext({ path: "src/index.ts" }),
        expected: [expected],
        fileStructure: parseFileStructure({ source }),
      });
      expect(result).toHaveLength(1);
    }
  );

  it("preserves alias-less matching for default and namespace imports", () => {
    const fileStructure = parseFileStructure({
      source: [
        'import DefaultValue from "default-pkg";',
        'import * as NamespaceValue from "namespace-pkg";',
        'import { default as NamedDefault } from "named-default-pkg";',
      ].join("\n"),
    });
    const result = checkImportValues({
      context: createMockContext({ path: "src/index.ts" }),
      expected: ["DefaultValue", "NamespaceValue", "NamedDefault"],
      fileStructure,
    });
    expect(result).toEqual([]);
  });

  it("includes conventionName when provided", () => {
    const result = checkImportValues({
      context: createMockContext({ path: "src/index.ts" }),
      conventionName: "regular-imports",
      expected: ["Missing"],
      fileStructure: createMockFileStructure({ imports: [] }),
    });
    expect(result[0].conventionName).toBe("regular-imports");
  });
});
