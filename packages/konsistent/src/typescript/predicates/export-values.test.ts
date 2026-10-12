import { describe, expect, it } from "vitest";
import type { PredicateContext } from "../../core/context.js";
import { parseFileStructure } from "../parser.js";
import type { FileStructure } from "../types.js";
import { checkExportValues } from "./export-values.js";

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
  exports?: FileStructure["exports"];
}): FileStructure {
  return {
    calls: [],
    classes: [],
    constants: [],
    declarationSymbols: [],
    defaultExportSymbols: [],
    exports: opts.exports ?? [],
    functions: [],
    importSources: [],
    imports: [],
    interfaces: [],
    namedExportSymbols: [],
    nonBarrelStatements: [],
    typeAliases: [],
  };
}

describe("checkExportValues", () => {
  it("returns no diagnostics when export is found", () => {
    const result = checkExportValues({
      context: createMockContext({ path: "src/index.ts" }),
      expected: ["myFunc"],
      fileStructure: createMockFileStructure({
        exports: [
          {
            isType: false,
            kind: "function",
            name: "myFunc",
            pos: { column: 1, line: 1 },
          },
        ],
      }),
    });
    expect(result).toEqual([]);
  });

  it("returns diagnostic when export is missing", () => {
    const result = checkExportValues({
      context: createMockContext({ path: "src/index.ts" }),
      expected: ["missingExport"],
      fileStructure: createMockFileStructure({ exports: [] }),
    });
    expect(result).toHaveLength(1);
    expect(result[0].message).toBe('Missing export "missingExport"');
    expect(result[0].predicateName).toBe("exportValues");
    expect(result[0].filePath).toBe("src/index.ts");
    expect(result[0].line).toBeUndefined();
    expect(result[0].column).toBeUndefined();
  });

  it("resolves template placeholders in export names", () => {
    const result = checkExportValues({
      context: createMockContext({
        path: "src/index.ts",
        placeholders: { providerId: { toString: () => "openai" } },
      }),
      expected: ["${providerId}"],
      fileStructure: createMockFileStructure({
        exports: [
          {
            isType: false,
            kind: "re-export",
            name: "openai",
            pos: { column: 1, line: 1 },
          },
        ],
      }),
    });
    expect(result).toEqual([]);
  });

  it("returns diagnostic for template-expanded name when missing", () => {
    const result = checkExportValues({
      context: createMockContext({
        path: "src/index.ts",
        placeholders: { providerId: { toString: () => "openai" } },
      }),
      expected: ["${providerId}"],
      fileStructure: createMockFileStructure({ exports: [] }),
    });
    expect(result).toHaveLength(1);
    expect(result[0].message).toBe('Missing export "openai"');
  });

  it("accepts ExportDefinition object form", () => {
    const result = checkExportValues({
      context: createMockContext({ path: "src/index.ts" }),
      expected: [{ name: "myConst" }],
      fileStructure: createMockFileStructure({
        exports: [
          {
            isType: false,
            kind: "const",
            name: "myConst",
            pos: { column: 1, line: 1 },
          },
        ],
      }),
    });
    expect(result).toEqual([]);
  });

  it("ignores type-only exports when checking", () => {
    const result = checkExportValues({
      context: createMockContext({ path: "src/index.ts" }),
      expected: ["MyInterface"],
      fileStructure: createMockFileStructure({
        exports: [
          {
            isType: true,
            kind: "interface",
            name: "MyInterface",
            pos: { column: 1, line: 1 },
          },
        ],
      }),
    });
    expect(result).toHaveLength(1);
    expect(result[0].message).toBe('Missing export "MyInterface"');
  });

  it("returns no diagnostics when re-export with matching from is found", () => {
    const result = checkExportValues({
      context: createMockContext({ path: "src/index.ts" }),
      expected: [{ from: "./utils", name: "helper" }],
      fileStructure: createMockFileStructure({
        exports: [
          {
            from: "./utils",
            isType: false,
            kind: "re-export",
            name: "helper",
            pos: { column: 1, line: 1 },
          },
        ],
      }),
    });
    expect(result).toEqual([]);
  });

  it("returns diagnostic when from does not match", () => {
    const result = checkExportValues({
      context: createMockContext({ path: "src/index.ts" }),
      expected: [{ from: "./utils", name: "helper" }],
      fileStructure: createMockFileStructure({
        exports: [
          {
            from: "./other",
            isType: false,
            kind: "re-export",
            name: "helper",
            pos: { column: 1, line: 1 },
          },
        ],
      }),
    });
    expect(result).toHaveLength(1);
    expect(result[0].message).toBe('Missing export "helper" from "./utils"');
  });

  it("resolves template placeholders in from", () => {
    const result = checkExportValues({
      context: createMockContext({
        path: "src/index.ts",
        placeholders: { name: { toString: () => "utils" } },
      }),
      expected: [{ from: "./${name}", name: "helper" }],
      fileStructure: createMockFileStructure({
        exports: [
          {
            from: "./utils",
            isType: false,
            kind: "re-export",
            name: "helper",
            pos: { column: 1, line: 1 },
          },
        ],
      }),
    });
    expect(result).toEqual([]);
  });

  it("does not require from when not specified in object form", () => {
    const result = checkExportValues({
      context: createMockContext({ path: "src/index.ts" }),
      expected: [{ name: "helper" }],
      fileStructure: createMockFileStructure({
        exports: [
          {
            from: "./anywhere",
            isType: false,
            kind: "re-export",
            name: "helper",
            pos: { column: 1, line: 1 },
          },
        ],
      }),
    });
    expect(result).toEqual([]);
  });

  it("matches an aliased named export by its original name", () => {
    const result = checkExportValues({
      context: createMockContext({ path: "src/index.ts" }),
      expected: ["localValue"],
      fileStructure: parseFileStructure({
        source: "const localValue = 1; export { localValue as publicValue };",
      }),
    });
    expect(result).toEqual([]);
  });

  it("requires an exact alias when configured", () => {
    const source =
      "const localValue = 1; export { localValue as publicValue };";
    const context = createMockContext({ path: "src/index.ts" });

    expect(
      checkExportValues({
        context,
        expected: [{ alias: "publicValue", name: "localValue" }],
        fileStructure: parseFileStructure({ source }),
      })
    ).toEqual([]);
    expect(
      checkExportValues({
        context,
        expected: [{ alias: "otherValue", name: "localValue" }],
        fileStructure: parseFileStructure({ source }),
      })[0].message
    ).toBe('Missing export "localValue" as "otherValue"');
  });

  it("matches an aliased re-export with a from constraint", () => {
    const result = checkExportValues({
      context: createMockContext({ path: "src/index.ts" }),
      expected: [
        { alias: "publicValue", from: "./source", name: "sourceValue" },
      ],
      fileStructure: parseFileStructure({
        source: 'export { sourceValue as publicValue } from "./source";',
      }),
    });
    expect(result).toEqual([]);
  });

  it("resolves template placeholders in aliases", () => {
    const result = checkExportValues({
      context: createMockContext({
        path: "src/index.ts",
        placeholders: { name: { toString: () => "Value" } },
      }),
      expected: [{ alias: "public${name}", name: "localValue" }],
      fileStructure: parseFileStructure({
        source: "const localValue = 1; export { localValue as publicValue };",
      }),
    });
    expect(result).toEqual([]);
  });

  it("allows an alias equal to the source name for a named export", () => {
    const result = checkExportValues({
      context: createMockContext({ path: "src/index.ts" }),
      expected: [{ alias: "localValue", name: "localValue" }],
      fileStructure: parseFileStructure({
        source: "const localValue = 1; export { localValue };",
      }),
    });
    expect(result).toEqual([]);
  });

  it("does not apply aliases to direct, default, or namespace exports", () => {
    const context = createMockContext({ path: "src/index.ts" });
    const cases = [
      {
        expected: { alias: "localValue", name: "localValue" },
        source: "export const localValue = 1;",
      },
      {
        expected: { alias: "PublicValue", name: "default" },
        source: 'export { default as PublicValue } from "./source";',
      },
      {
        expected: { alias: "PublicNamespace", name: "*" },
        source: 'export * as PublicNamespace from "./source";',
      },
    ];

    for (const entry of cases) {
      expect(
        checkExportValues({
          context,
          expected: [entry.expected],
          fileStructure: parseFileStructure({ source: entry.source }),
        })
      ).toHaveLength(1);
    }
  });

  it("includes conventionName when provided", () => {
    const result = checkExportValues({
      context: createMockContext({ path: "src/index.ts" }),
      conventionName: "barrel-exports",
      expected: ["missing"],
      fileStructure: createMockFileStructure({ exports: [] }),
    });
    expect(result[0].conventionName).toBe("barrel-exports");
  });
});
