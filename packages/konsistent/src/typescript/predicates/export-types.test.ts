import { describe, expect, it } from "vitest";
import type { PredicateContext } from "../../core/context.js";
import { parseFileStructure } from "../parser.js";
import type { FileStructure } from "../types.js";
import { checkExportTypes } from "./export-types.js";

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

describe("checkExportTypes", () => {
  it("returns no diagnostics when type export is found", () => {
    const result = checkExportTypes({
      context: createMockContext({ path: "src/index.ts" }),
      expected: ["MyType"],
      fileStructure: createMockFileStructure({
        exports: [
          {
            isType: true,
            kind: "interface",
            name: "MyType",
            pos: { column: 1, line: 1 },
          },
        ],
      }),
    });
    expect(result).toEqual([]);
  });

  it("returns diagnostic when type export is missing", () => {
    const result = checkExportTypes({
      context: createMockContext({ path: "src/index.ts" }),
      expected: ["MyType"],
      fileStructure: createMockFileStructure({ exports: [] }),
    });
    expect(result).toHaveLength(1);
    expect(result[0].message).toBe('Missing export type "MyType"');
    expect(result[0].predicateName).toBe("exportTypes");
    expect(result[0].filePath).toBe("src/index.ts");
  });

  it("ignores non-type exports", () => {
    const result = checkExportTypes({
      context: createMockContext({ path: "src/index.ts" }),
      expected: ["MyFunc"],
      fileStructure: createMockFileStructure({
        exports: [
          {
            isType: false,
            kind: "function",
            name: "MyFunc",
            pos: { column: 1, line: 1 },
          },
        ],
      }),
    });
    expect(result).toHaveLength(1);
    expect(result[0].message).toBe('Missing export type "MyFunc"');
  });

  it("resolves template placeholders", () => {
    const result = checkExportTypes({
      context: createMockContext({
        path: "src/index.ts",
        placeholders: { name: { toString: () => "Button" } },
      }),
      expected: ["${name}Props"],
      fileStructure: createMockFileStructure({
        exports: [
          {
            isType: true,
            kind: "interface",
            name: "ButtonProps",
            pos: { column: 1, line: 1 },
          },
        ],
      }),
    });
    expect(result).toEqual([]);
  });

  it("returns diagnostic for template-expanded name when missing", () => {
    const result = checkExportTypes({
      context: createMockContext({
        path: "src/index.ts",
        placeholders: { name: { toString: () => "Button" } },
      }),
      expected: ["${name}Props"],
      fileStructure: createMockFileStructure({ exports: [] }),
    });
    expect(result).toHaveLength(1);
    expect(result[0].message).toBe('Missing export type "ButtonProps"');
  });

  it("accepts ExportDefinition object form", () => {
    const result = checkExportTypes({
      context: createMockContext({ path: "src/index.ts" }),
      expected: [{ name: "Config" }],
      fileStructure: createMockFileStructure({
        exports: [
          {
            isType: true,
            kind: "interface",
            name: "Config",
            pos: { column: 1, line: 1 },
          },
        ],
      }),
    });
    expect(result).toEqual([]);
  });

  it("returns no diagnostics when type re-export with matching from is found", () => {
    const result = checkExportTypes({
      context: createMockContext({ path: "src/index.ts" }),
      expected: [{ from: "./types", name: "MyType" }],
      fileStructure: createMockFileStructure({
        exports: [
          {
            from: "./types",
            isType: true,
            kind: "re-export",
            name: "MyType",
            pos: { column: 1, line: 1 },
          },
        ],
      }),
    });
    expect(result).toEqual([]);
  });

  it("returns diagnostic when from does not match", () => {
    const result = checkExportTypes({
      context: createMockContext({ path: "src/index.ts" }),
      expected: [{ from: "./types", name: "MyType" }],
      fileStructure: createMockFileStructure({
        exports: [
          {
            from: "./other",
            isType: true,
            kind: "re-export",
            name: "MyType",
            pos: { column: 1, line: 1 },
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
      context: createMockContext({
        path: "src/index.ts",
        placeholders: { name: { toString: () => "types" } },
      }),
      expected: [{ from: "./${name}", name: "MyType" }],
      fileStructure: createMockFileStructure({
        exports: [
          {
            from: "./types",
            isType: true,
            kind: "re-export",
            name: "MyType",
            pos: { column: 1, line: 1 },
          },
        ],
      }),
    });
    expect(result).toEqual([]);
  });

  it("does not require from when not specified in object form", () => {
    const result = checkExportTypes({
      context: createMockContext({ path: "src/index.ts" }),
      expected: [{ name: "MyType" }],
      fileStructure: createMockFileStructure({
        exports: [
          {
            from: "./anywhere",
            isType: true,
            kind: "re-export",
            name: "MyType",
            pos: { column: 1, line: 1 },
          },
        ],
      }),
    });
    expect(result).toEqual([]);
  });

  it("matches an aliased named type export by its original name", () => {
    const result = checkExportTypes({
      context: createMockContext({ path: "src/index.ts" }),
      expected: ["LocalType"],
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
        context,
        expected: [{ alias: "PublicType", name: "LocalType" }],
        fileStructure: parseFileStructure({ source }),
      })
    ).toEqual([]);
    expect(
      checkExportTypes({
        context,
        expected: [{ alias: "OtherType", name: "LocalType" }],
        fileStructure: parseFileStructure({ source }),
      })[0].message
    ).toBe('Missing export type "LocalType" as "OtherType"');
  });

  it("matches an aliased type re-export with a from constraint", () => {
    const result = checkExportTypes({
      context: createMockContext({ path: "src/index.ts" }),
      expected: [{ alias: "PublicType", from: "./source", name: "SourceType" }],
      fileStructure: parseFileStructure({
        source: 'export type { SourceType as PublicType } from "./source";',
      }),
    });
    expect(result).toEqual([]);
  });

  it("resolves template placeholders in aliases", () => {
    const result = checkExportTypes({
      context: createMockContext({
        path: "src/index.ts",
        placeholders: { name: { toString: () => "Type" } },
      }),
      expected: [{ alias: "Public${name}", name: "LocalType" }],
      fileStructure: parseFileStructure({
        source:
          "type LocalType = string; export type { LocalType as PublicType };",
      }),
    });
    expect(result).toEqual([]);
  });

  it("allows an alias equal to the source name for a named type export", () => {
    const result = checkExportTypes({
      context: createMockContext({ path: "src/index.ts" }),
      expected: [{ alias: "LocalType", name: "LocalType" }],
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
        expected: { alias: "LocalType", name: "LocalType" },
        source: "export type LocalType = string;",
      },
      {
        expected: { alias: "PublicType", name: "default" },
        source: 'export type { default as PublicType } from "./source";',
      },
    ];

    for (const entry of cases) {
      expect(
        checkExportTypes({
          context,
          expected: [entry.expected],
          fileStructure: parseFileStructure({ source: entry.source }),
        })
      ).toHaveLength(1);
    }
  });

  it("includes conventionName when provided", () => {
    const result = checkExportTypes({
      context: createMockContext({ path: "src/index.ts" }),
      conventionName: "type-exports",
      expected: ["Missing"],
      fileStructure: createMockFileStructure({ exports: [] }),
    });
    expect(result[0].conventionName).toBe("type-exports");
  });

  it("validates a partial object schema for a local type export", () => {
    const result = checkExportTypes({
      context: createMockContext({
        path: "src/index.ts",
        placeholders: {
          providersType: {
            toString: () => "ReadonlyArray<ModelProvider>",
          },
        },
      }),
      expected: [
        {
          name: "ModuleSettings",
          schema: {
            properties: {
              model: { type: "string" },
              providers: "${providersType}",
              timeout: { type: "number" },
            },
            type: "object",
          },
        },
      ],
      fileStructure: parseFileStructure({
        source: `
          export type ModuleSettings = {
            model?: string;
            timeout?: number;
            providers?: ReadonlyArray<ModelProvider>;
            reasoning?: "low" | "medium" | "high";
          };
        `,
      }),
    });
    expect(result).toEqual([]);
  });

  it("validates the original local type definition through an export alias", () => {
    const result = checkExportTypes({
      context: createMockContext({ path: "src/index.ts" }),
      expected: [
        {
          alias: "PublicSettings",
          name: "ModuleSettings",
          schema: {
            properties: { model: { type: "string" } },
            type: "object",
          },
        },
      ],
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
      context: createMockContext({ path: "src/index.ts" }),
      expected: [
        {
          name: "ModuleSettings",
          schema: {
            properties: { timeout: { type: "number" } },
            type: "object",
          },
        },
      ],
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
      context: createMockContext({ path: "src/index.ts" }),
      expected: [
        {
          name: "Settings",
          schema: {
            properties: { enabled: { type: "boolean" } },
            type: "object",
          },
        },
      ],
      fileStructure: parseFileStructure({
        source: "export interface Settings { enabled?: boolean }",
      }),
    });
    expect(result).toEqual([]);
  });

  it("requires a local definition for schema-constrained re-exports", () => {
    const result = checkExportTypes({
      context: createMockContext({ path: "src/index.ts" }),
      expected: [
        {
          name: "Settings",
          schema: { properties: {}, type: "object" },
        },
      ],
      fileStructure: parseFileStructure({
        source: 'export type { Settings } from "./settings";',
      }),
    });
    expect(result).toHaveLength(1);
    expect(result[0].message).toBe(
      'Type "Settings" must have a local type definition'
    );
  });

  it("validates an exact type alias expression through an export alias", () => {
    const result = checkExportTypes({
      context: createMockContext({
        path: "src/index.ts",
        placeholders: { name: { toString: () => "Shared" } },
      }),
      expected: [
        {
          alias: "PublicSettings",
          name: "Settings",
          type: "${name}Settings<'generic-value'>",
        },
      ],
      fileStructure: parseFileStructure({
        source: [
          "type Settings = SharedSettings<'generic-value'>;",
          "export type { Settings as PublicSettings };",
        ].join("\n"),
      }),
    });
    expect(result).toEqual([]);
  });

  it("ignores formatting differences in exact type expressions", () => {
    const result = checkExportTypes({
      context: createMockContext({ path: "src/index.ts" }),
      expected: [{ name: "Settings", type: "Left | Right" }],
      fileStructure: parseFileStructure({
        source: "export type Settings = Left|Right;",
      }),
    });
    expect(result).toEqual([]);
  });

  it("does not treat an exported interface as a type alias expression", () => {
    const result = checkExportTypes({
      context: createMockContext({ path: "src/index.ts" }),
      expected: [{ name: "Settings", type: "SharedSettings" }],
      fileStructure: parseFileStructure({
        source: "export interface Settings {}",
      }),
    });
    expect(result[0].message).toBe('Type "Settings" must be a type alias');
  });
});
