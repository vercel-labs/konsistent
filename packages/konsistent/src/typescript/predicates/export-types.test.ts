import { describe, expect, it } from "vitest";
import type { PredicateContext } from "../../core/context.js";
import { parseFileStructure } from "../parser.js";
import type { FileStructure } from "../types.js";
import { checkExportTypes } from "./export-types.js";

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

describe("checkExportTypes", () => {
  it("returns no diagnostics when type export is found", () => {
    const result = checkExportTypes({
      expected: ["MyType"],
      context: createMockContext({ path: "src/index.ts" }),
      fileStructure: createMockFileStructure({
        exports: [
          {
            name: "MyType",
            kind: "interface",
            isType: true,
            pos: { line: 1, column: 1 },
          },
        ],
      }),
    });
    expect(result).toEqual([]);
  });

  it("returns diagnostic when type export is missing", () => {
    const result = checkExportTypes({
      expected: ["MyType"],
      context: createMockContext({ path: "src/index.ts" }),
      fileStructure: createMockFileStructure({ exports: [] }),
    });
    expect(result).toHaveLength(1);
    expect(result[0].message).toBe('Missing export type "MyType"');
    expect(result[0].predicateName).toBe("exportTypes");
    expect(result[0].filePath).toBe("src/index.ts");
  });

  it("ignores non-type exports", () => {
    const result = checkExportTypes({
      expected: ["MyFunc"],
      context: createMockContext({ path: "src/index.ts" }),
      fileStructure: createMockFileStructure({
        exports: [
          {
            name: "MyFunc",
            kind: "function",
            isType: false,
            pos: { line: 1, column: 1 },
          },
        ],
      }),
    });
    expect(result).toHaveLength(1);
    expect(result[0].message).toBe('Missing export type "MyFunc"');
  });

  it("resolves template placeholders", () => {
    const result = checkExportTypes({
      expected: ["${name}Props"],
      context: createMockContext({
        path: "src/index.ts",
        placeholders: { name: { toString: () => "Button" } },
      }),
      fileStructure: createMockFileStructure({
        exports: [
          {
            name: "ButtonProps",
            kind: "interface",
            isType: true,
            pos: { line: 1, column: 1 },
          },
        ],
      }),
    });
    expect(result).toEqual([]);
  });

  it("returns diagnostic for template-expanded name when missing", () => {
    const result = checkExportTypes({
      expected: ["${name}Props"],
      context: createMockContext({
        path: "src/index.ts",
        placeholders: { name: { toString: () => "Button" } },
      }),
      fileStructure: createMockFileStructure({ exports: [] }),
    });
    expect(result).toHaveLength(1);
    expect(result[0].message).toBe('Missing export type "ButtonProps"');
  });

  it("accepts ExportDefinition object form", () => {
    const result = checkExportTypes({
      expected: [{ name: "Config" }],
      context: createMockContext({ path: "src/index.ts" }),
      fileStructure: createMockFileStructure({
        exports: [
          {
            name: "Config",
            kind: "interface",
            isType: true,
            pos: { line: 1, column: 1 },
          },
        ],
      }),
    });
    expect(result).toEqual([]);
  });

  it("returns no diagnostics when type re-export with matching from is found", () => {
    const result = checkExportTypes({
      expected: [{ name: "MyType", from: "./types" }],
      context: createMockContext({ path: "src/index.ts" }),
      fileStructure: createMockFileStructure({
        exports: [
          {
            name: "MyType",
            kind: "re-export",
            from: "./types",
            isType: true,
            pos: { line: 1, column: 1 },
          },
        ],
      }),
    });
    expect(result).toEqual([]);
  });

  it("returns diagnostic when from does not match", () => {
    const result = checkExportTypes({
      expected: [{ name: "MyType", from: "./types" }],
      context: createMockContext({ path: "src/index.ts" }),
      fileStructure: createMockFileStructure({
        exports: [
          {
            name: "MyType",
            kind: "re-export",
            from: "./other",
            isType: true,
            pos: { line: 1, column: 1 },
          },
        ],
      }),
    });
    expect(result).toHaveLength(1);
    expect(result[0].message).toBe(
      'Missing export type "MyType" from "./types"'
    );
  });

  it("resolves template placeholders in from", () => {
    const result = checkExportTypes({
      expected: [{ name: "MyType", from: "./${name}" }],
      context: createMockContext({
        path: "src/index.ts",
        placeholders: { name: { toString: () => "types" } },
      }),
      fileStructure: createMockFileStructure({
        exports: [
          {
            name: "MyType",
            kind: "re-export",
            from: "./types",
            isType: true,
            pos: { line: 1, column: 1 },
          },
        ],
      }),
    });
    expect(result).toEqual([]);
  });

  it("does not require from when not specified in object form", () => {
    const result = checkExportTypes({
      expected: [{ name: "MyType" }],
      context: createMockContext({ path: "src/index.ts" }),
      fileStructure: createMockFileStructure({
        exports: [
          {
            name: "MyType",
            kind: "re-export",
            from: "./anywhere",
            isType: true,
            pos: { line: 1, column: 1 },
          },
        ],
      }),
    });
    expect(result).toEqual([]);
  });

  it("matches an aliased named type export by its original name", () => {
    const result = checkExportTypes({
      expected: ["LocalType"],
      context: createMockContext({ path: "src/index.ts" }),
      fileStructure: parseFileStructure({
        source:
          "type LocalType = string; export type { LocalType as PublicType };",
      }),
    });
    expect(result).toEqual([]);
  });

  it("requires an exact alias when configured", () => {
    const source =
      "type LocalType = string; export type { LocalType as PublicType };";
    const context = createMockContext({ path: "src/index.ts" });

    expect(
      checkExportTypes({
        expected: [{ name: "LocalType", alias: "PublicType" }],
        context,
        fileStructure: parseFileStructure({ source }),
      })
    ).toEqual([]);
    expect(
      checkExportTypes({
        expected: [{ name: "LocalType", alias: "OtherType" }],
        context,
        fileStructure: parseFileStructure({ source }),
      })[0].message
    ).toBe('Missing export type "LocalType" as "OtherType"');
  });

  it("matches an aliased type re-export with a from constraint", () => {
    const result = checkExportTypes({
      expected: [{ name: "SourceType", alias: "PublicType", from: "./source" }],
      context: createMockContext({ path: "src/index.ts" }),
      fileStructure: parseFileStructure({
        source: 'export type { SourceType as PublicType } from "./source";',
      }),
    });
    expect(result).toEqual([]);
  });

  it("resolves template placeholders in aliases", () => {
    const result = checkExportTypes({
      expected: [{ name: "LocalType", alias: "Public${name}" }],
      context: createMockContext({
        path: "src/index.ts",
        placeholders: { name: { toString: () => "Type" } },
      }),
      fileStructure: parseFileStructure({
        source:
          "type LocalType = string; export type { LocalType as PublicType };",
      }),
    });
    expect(result).toEqual([]);
  });

  it("allows an alias equal to the source name for a named type export", () => {
    const result = checkExportTypes({
      expected: [{ name: "LocalType", alias: "LocalType" }],
      context: createMockContext({ path: "src/index.ts" }),
      fileStructure: parseFileStructure({
        source: "type LocalType = string; export type { LocalType };",
      }),
    });
    expect(result).toEqual([]);
  });

  it("does not apply aliases to direct or default type exports", () => {
    const context = createMockContext({ path: "src/index.ts" });
    const cases = [
      {
        source: "export type LocalType = string;",
        expected: { name: "LocalType", alias: "LocalType" },
      },
      {
        source: 'export type { default as PublicType } from "./source";',
        expected: { name: "default", alias: "PublicType" },
      },
    ];

    for (const entry of cases) {
      expect(
        checkExportTypes({
          expected: [entry.expected],
          context,
          fileStructure: parseFileStructure({ source: entry.source }),
        })
      ).toHaveLength(1);
    }
  });

  it("includes conventionName when provided", () => {
    const result = checkExportTypes({
      expected: ["Missing"],
      context: createMockContext({ path: "src/index.ts" }),
      fileStructure: createMockFileStructure({ exports: [] }),
      conventionName: "type-exports",
    });
    expect(result[0].conventionName).toBe("type-exports");
  });

  it("validates a partial object schema for a local type export", () => {
    const result = checkExportTypes({
      expected: [
        {
          name: "ModuleSettings",
          schema: {
            type: "object",
            properties: {
              model: { type: "string" },
              timeout: { type: "number" },
            },
          },
        },
      ],
      context: createMockContext({ path: "src/index.ts" }),
      fileStructure: parseFileStructure({
        source: `
          export type ModuleSettings = {
            model?: string;
            timeout?: number;
            reasoning?: "low" | "medium" | "high";
          };
        `,
      }),
    });
    expect(result).toEqual([]);
  });

  it("validates the original local type definition through an export alias", () => {
    const result = checkExportTypes({
      expected: [
        {
          name: "ModuleSettings",
          alias: "PublicSettings",
          schema: {
            type: "object",
            properties: { model: { type: "string" } },
          },
        },
      ],
      context: createMockContext({ path: "src/index.ts" }),
      fileStructure: parseFileStructure({
        source: `
          type ModuleSettings = { model?: string };
          export type { ModuleSettings as PublicSettings };
        `,
      }),
    });
    expect(result).toEqual([]);
  });

  it("reports a local exported type missing a configured property", () => {
    const result = checkExportTypes({
      expected: [
        {
          name: "ModuleSettings",
          schema: {
            type: "object",
            properties: { timeout: { type: "number" } },
          },
        },
      ],
      context: createMockContext({ path: "src/index.ts" }),
      fileStructure: parseFileStructure({
        source: "export type ModuleSettings = { model?: string };",
      }),
    });
    expect(result).toHaveLength(1);
    expect(result[0].message).toBe(
      'Type "ModuleSettings" must define property "timeout"'
    );
  });

  it("validates schemas for exported interfaces", () => {
    const result = checkExportTypes({
      expected: [
        {
          name: "Settings",
          schema: {
            type: "object",
            properties: { enabled: { type: "boolean" } },
          },
        },
      ],
      context: createMockContext({ path: "src/index.ts" }),
      fileStructure: parseFileStructure({
        source: "export interface Settings { enabled?: boolean }",
      }),
    });
    expect(result).toEqual([]);
  });

  it("requires a local definition for schema-constrained re-exports", () => {
    const result = checkExportTypes({
      expected: [
        {
          name: "Settings",
          schema: { type: "object", properties: {} },
        },
      ],
      context: createMockContext({ path: "src/index.ts" }),
      fileStructure: parseFileStructure({
        source: 'export type { Settings } from "./settings";',
      }),
    });
    expect(result).toHaveLength(1);
    expect(result[0].message).toBe(
      'Type "Settings" must have a local type definition'
    );
  });
});
