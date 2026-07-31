import { describe, expect, it } from "vitest";
import type { PredicateContext } from "../../core/context.js";
import { parseFileStructure } from "../parser.js";
import type { FileStructure } from "../types.js";
import { checkExportValues } from "./export-values.js";

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
  exports?: FileStructure["exports"];
}): FileStructure {
  return {
    exports: opts.exports ?? [],
    imports: [],
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

describe("checkExportValues", () => {
  it("returns no diagnostics when export is found", () => {
    const result = checkExportValues({
      expected: ["myFunc"],
      context: createMockContext({ path: "src/index.ts" }),
      fileStructure: createMockFileStructure({
        exports: [
          {
            name: "myFunc",
            kind: "function",
            isType: false,
            pos: { line: 1, column: 1 },
          },
        ],
      }),
    });
    expect(result).toEqual([]);
  });

  it("returns diagnostic when export is missing", () => {
    const result = checkExportValues({
      expected: ["missingExport"],
      context: createMockContext({ path: "src/index.ts" }),
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
      expected: ["${providerId}"],
      context: createMockContext({
        path: "src/index.ts",
        placeholders: { providerId: { toString: () => "openai" } },
      }),
      fileStructure: createMockFileStructure({
        exports: [
          {
            name: "openai",
            kind: "re-export",
            isType: false,
            pos: { line: 1, column: 1 },
          },
        ],
      }),
    });
    expect(result).toEqual([]);
  });

  it("returns diagnostic for template-expanded name when missing", () => {
    const result = checkExportValues({
      expected: ["${providerId}"],
      context: createMockContext({
        path: "src/index.ts",
        placeholders: { providerId: { toString: () => "openai" } },
      }),
      fileStructure: createMockFileStructure({ exports: [] }),
    });
    expect(result).toHaveLength(1);
    expect(result[0].message).toBe('Missing export "openai"');
  });

  it("accepts ExportDefinition object form", () => {
    const result = checkExportValues({
      expected: [{ name: "myConst" }],
      context: createMockContext({ path: "src/index.ts" }),
      fileStructure: createMockFileStructure({
        exports: [
          {
            name: "myConst",
            kind: "const",
            isType: false,
            pos: { line: 1, column: 1 },
          },
        ],
      }),
    });
    expect(result).toEqual([]);
  });

  it("ignores type-only exports when checking", () => {
    const result = checkExportValues({
      expected: ["MyInterface"],
      context: createMockContext({ path: "src/index.ts" }),
      fileStructure: createMockFileStructure({
        exports: [
          {
            name: "MyInterface",
            kind: "interface",
            isType: true,
            pos: { line: 1, column: 1 },
          },
        ],
      }),
    });
    expect(result).toHaveLength(1);
    expect(result[0].message).toBe('Missing export "MyInterface"');
  });

  it("returns no diagnostics when re-export with matching from is found", () => {
    const result = checkExportValues({
      expected: [{ name: "helper", from: "./utils" }],
      context: createMockContext({ path: "src/index.ts" }),
      fileStructure: createMockFileStructure({
        exports: [
          {
            name: "helper",
            kind: "re-export",
            from: "./utils",
            isType: false,
            pos: { line: 1, column: 1 },
          },
        ],
      }),
    });
    expect(result).toEqual([]);
  });

  it("returns diagnostic when from does not match", () => {
    const result = checkExportValues({
      expected: [{ name: "helper", from: "./utils" }],
      context: createMockContext({ path: "src/index.ts" }),
      fileStructure: createMockFileStructure({
        exports: [
          {
            name: "helper",
            kind: "re-export",
            from: "./other",
            isType: false,
            pos: { line: 1, column: 1 },
          },
        ],
      }),
    });
    expect(result).toHaveLength(1);
    expect(result[0].message).toBe('Missing export "helper" from "./utils"');
  });

  it("resolves template placeholders in from", () => {
    const result = checkExportValues({
      expected: [{ name: "helper", from: "./${name}" }],
      context: createMockContext({
        path: "src/index.ts",
        placeholders: { name: { toString: () => "utils" } },
      }),
      fileStructure: createMockFileStructure({
        exports: [
          {
            name: "helper",
            kind: "re-export",
            from: "./utils",
            isType: false,
            pos: { line: 1, column: 1 },
          },
        ],
      }),
    });
    expect(result).toEqual([]);
  });

  it("does not require from when not specified in object form", () => {
    const result = checkExportValues({
      expected: [{ name: "helper" }],
      context: createMockContext({ path: "src/index.ts" }),
      fileStructure: createMockFileStructure({
        exports: [
          {
            name: "helper",
            kind: "re-export",
            from: "./anywhere",
            isType: false,
            pos: { line: 1, column: 1 },
          },
        ],
      }),
    });
    expect(result).toEqual([]);
  });

  it("matches an aliased named export by its original name", () => {
    const result = checkExportValues({
      expected: ["localValue"],
      context: createMockContext({ path: "src/index.ts" }),
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
        expected: [{ name: "localValue", alias: "publicValue" }],
        context,
        fileStructure: parseFileStructure({ source }),
      })
    ).toEqual([]);
    expect(
      checkExportValues({
        expected: [{ name: "localValue", alias: "otherValue" }],
        context,
        fileStructure: parseFileStructure({ source }),
      })[0].message
    ).toBe('Missing export "localValue" as "otherValue"');
  });

  it("matches an aliased re-export with a from constraint", () => {
    const result = checkExportValues({
      expected: [
        { name: "sourceValue", alias: "publicValue", from: "./source" },
      ],
      context: createMockContext({ path: "src/index.ts" }),
      fileStructure: parseFileStructure({
        source: 'export { sourceValue as publicValue } from "./source";',
      }),
    });
    expect(result).toEqual([]);
  });

  it("resolves template placeholders in aliases", () => {
    const result = checkExportValues({
      expected: [{ name: "localValue", alias: "public${name}" }],
      context: createMockContext({
        path: "src/index.ts",
        placeholders: { name: { toString: () => "Value" } },
      }),
      fileStructure: parseFileStructure({
        source: "const localValue = 1; export { localValue as publicValue };",
      }),
    });
    expect(result).toEqual([]);
  });

  it("allows an alias equal to the source name for a named export", () => {
    const result = checkExportValues({
      expected: [{ name: "localValue", alias: "localValue" }],
      context: createMockContext({ path: "src/index.ts" }),
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
        source: "export const localValue = 1;",
        expected: { name: "localValue", alias: "localValue" },
      },
      {
        source: 'export { default as PublicValue } from "./source";',
        expected: { name: "default", alias: "PublicValue" },
      },
      {
        source: 'export * as PublicNamespace from "./source";',
        expected: { name: "*", alias: "PublicNamespace" },
      },
    ];

    for (const entry of cases) {
      expect(
        checkExportValues({
          expected: [entry.expected],
          context,
          fileStructure: parseFileStructure({ source: entry.source }),
        })
      ).toHaveLength(1);
    }
  });

  it("includes conventionName when provided", () => {
    const result = checkExportValues({
      expected: ["missing"],
      context: createMockContext({ path: "src/index.ts" }),
      fileStructure: createMockFileStructure({ exports: [] }),
      conventionName: "barrel-exports",
    });
    expect(result[0].conventionName).toBe("barrel-exports");
  });
});
