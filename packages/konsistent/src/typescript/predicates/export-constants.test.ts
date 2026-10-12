import { describe, expect, it } from "vitest";
import type { PredicateContext } from "../../core/context.js";
import { parseFileStructure } from "../parser.js";
import type { FileStructure } from "../types.js";
import { checkExportConstants } from "./export-constants.js";

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

describe("checkExportConstants", () => {
  it("returns no diagnostics when exported constant is found", () => {
    const result = checkExportConstants({
      context: createMockContext({ path: "src/index.ts" }),
      expected: ["MY_CONST"],
      fileStructure: createMockFileStructure({
        exports: [
          {
            isType: false,
            kind: "const",
            name: "MY_CONST",
            pos: { column: 1, line: 1 },
          },
        ],
      }),
    });
    expect(result).toEqual([]);
  });

  it("returns diagnostic when exported constant is missing", () => {
    const result = checkExportConstants({
      context: createMockContext({ path: "src/index.ts" }),
      expected: ["MY_CONST"],
      fileStructure: createMockFileStructure({ exports: [] }),
    });
    expect(result).toHaveLength(1);
    expect(result[0].message).toBe('Missing export constant "MY_CONST"');
    expect(result[0].predicateName).toBe("exportConstants");
    expect(result[0].filePath).toBe("src/index.ts");
  });

  it("ignores non-const exports", () => {
    const result = checkExportConstants({
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
    expect(result).toHaveLength(1);
    expect(result[0].message).toBe('Missing export constant "myFunc"');
  });

  it("ignores type exports of constants", () => {
    const result = checkExportConstants({
      context: createMockContext({ path: "src/index.ts" }),
      expected: ["MY_CONST"],
      fileStructure: createMockFileStructure({
        exports: [
          {
            isType: true,
            kind: "const",
            name: "MY_CONST",
            pos: { column: 1, line: 1 },
          },
        ],
      }),
    });
    expect(result).toHaveLength(1);
    expect(result[0].message).toBe('Missing export constant "MY_CONST"');
  });

  it("resolves template placeholders", () => {
    const result = checkExportConstants({
      context: createMockContext({
        path: "src/index.ts",
        placeholders: { prefix: { toString: () => "APP" } },
      }),
      expected: ["${prefix}_CONFIG"],
      fileStructure: createMockFileStructure({
        exports: [
          {
            isType: false,
            kind: "const",
            name: "APP_CONFIG",
            pos: { column: 1, line: 1 },
          },
        ],
      }),
    });
    expect(result).toEqual([]);
  });

  it("returns diagnostic for template-expanded name when missing", () => {
    const result = checkExportConstants({
      context: createMockContext({
        path: "src/index.ts",
        placeholders: { prefix: { toString: () => "APP" } },
      }),
      expected: ["${prefix}_CONFIG"],
      fileStructure: createMockFileStructure({ exports: [] }),
    });
    expect(result).toHaveLength(1);
    expect(result[0].message).toBe('Missing export constant "APP_CONFIG"');
  });

  it("accepts ExportDefinition object form", () => {
    const result = checkExportConstants({
      context: createMockContext({ path: "src/index.ts" }),
      expected: [{ name: "MY_CONST" }],
      fileStructure: createMockFileStructure({
        exports: [
          {
            isType: false,
            kind: "const",
            name: "MY_CONST",
            pos: { column: 1, line: 1 },
          },
        ],
      }),
    });
    expect(result).toEqual([]);
  });

  it("includes conventionName when provided", () => {
    const result = checkExportConstants({
      context: createMockContext({ path: "src/index.ts" }),
      conventionName: "const-exports",
      expected: ["missing"],
      fileStructure: createMockFileStructure({ exports: [] }),
    });
    expect(result[0].conventionName).toBe("const-exports");
  });

  it("validates a configured constant schema", () => {
    const result = checkExportConstants({
      context: createMockContext({ path: "src/index.ts" }),
      expected: [
        {
          name: "mode",
          schema: {
            enum: ["development", "production"],
            type: "string",
          },
        },
      ],
      fileStructure: parseFileStructure({
        source:
          'export const mode: "development" | "production" = "development";',
      }),
    });
    expect(result).toEqual([]);
  });

  it("validates type references in an object schema", () => {
    const result = checkExportConstants({
      context: createMockContext({
        path: "src/index.ts",
        placeholders: {
          authType: { toString: () => "Readonly<MyAuth>" },
        },
      }),
      expected: [
        {
          name: "settings",
          schema: {
            properties: { auth: "${authType}" },
            required: ["auth"],
            type: "object",
          },
        },
      ],
      fileStructure: parseFileStructure({
        source:
          "export const settings: { auth: Readonly<MyAuth> } = { auth: {} };",
      }),
    });
    expect(result).toEqual([]);
  });

  it("reports an object schema mismatch", () => {
    const result = checkExportConstants({
      context: createMockContext({ path: "src/index.ts" }),
      expected: [
        {
          name: "options",
          schema: {
            additionalProperties: false,
            properties: { endpoint: { type: "string" } },
            required: ["endpoint"],
            type: "object",
          },
        },
      ],
      fileStructure: parseFileStructure({
        source:
          'export const options: { endpoint: string; retries: number } = { endpoint: "", retries: 1 };',
      }),
    });
    expect(result).toHaveLength(1);
    expect(result[0].message).toBe(
      'Constant "options" must not have additional property "retries"'
    );
  });

  it("validates an exact template-expanded type annotation", () => {
    const result = checkExportConstants({
      context: createMockContext({
        path: "src/index.ts",
        placeholders: { name: { toString: () => "Module" } },
      }),
      expected: [{ name: "settings", type: "${name}Settings<'public'>" }],
      fileStructure: parseFileStructure({
        source:
          "export const settings: ModuleSettings<'public'> = { enabled: true };",
      }),
    });
    expect(result).toEqual([]);
  });

  it("reports a mismatched exact type annotation", () => {
    const result = checkExportConstants({
      context: createMockContext({ path: "src/index.ts" }),
      expected: [{ name: "settings", type: "Readonly<ModuleSettings>" }],
      fileStructure: parseFileStructure({
        source: "export const settings: ModuleSettings = {};",
      }),
    });
    expect(result[0].message).toBe(
      'Constant "settings" must have type "Readonly<ModuleSettings>"'
    );
  });
});
