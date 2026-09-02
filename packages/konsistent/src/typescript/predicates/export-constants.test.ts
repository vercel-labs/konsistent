import { describe, expect, it } from "vitest";
import type { PredicateContext } from "../../core/context.js";
import { parseFileStructure } from "../parser.js";
import type { FileStructure } from "../types.js";
import { checkExportConstants } from "./export-constants.js";

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

describe("checkExportConstants", () => {
  it("returns no diagnostics when exported constant is found", () => {
    const result = checkExportConstants({
      expected: ["MY_CONST"],
      context: createMockContext({ path: "src/index.ts" }),
      fileStructure: createMockFileStructure({
        exports: [
          {
            name: "MY_CONST",
            kind: "const",
            isType: false,
            pos: { line: 1, column: 1 },
          },
        ],
      }),
    });
    expect(result).toEqual([]);
  });

  it("returns diagnostic when exported constant is missing", () => {
    const result = checkExportConstants({
      expected: ["MY_CONST"],
      context: createMockContext({ path: "src/index.ts" }),
      fileStructure: createMockFileStructure({ exports: [] }),
    });
    expect(result).toHaveLength(1);
    expect(result[0].message).toBe('Missing export constant "MY_CONST"');
    expect(result[0].predicateName).toBe("exportConstants");
    expect(result[0].filePath).toBe("src/index.ts");
  });

  it("ignores non-const exports", () => {
    const result = checkExportConstants({
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
    expect(result).toHaveLength(1);
    expect(result[0].message).toBe('Missing export constant "myFunc"');
  });

  it("ignores type exports of constants", () => {
    const result = checkExportConstants({
      expected: ["MY_CONST"],
      context: createMockContext({ path: "src/index.ts" }),
      fileStructure: createMockFileStructure({
        exports: [
          {
            name: "MY_CONST",
            kind: "const",
            isType: true,
            pos: { line: 1, column: 1 },
          },
        ],
      }),
    });
    expect(result).toHaveLength(1);
    expect(result[0].message).toBe('Missing export constant "MY_CONST"');
  });

  it("resolves template placeholders", () => {
    const result = checkExportConstants({
      expected: ["${prefix}_CONFIG"],
      context: createMockContext({
        path: "src/index.ts",
        placeholders: { prefix: { toString: () => "APP" } },
      }),
      fileStructure: createMockFileStructure({
        exports: [
          {
            name: "APP_CONFIG",
            kind: "const",
            isType: false,
            pos: { line: 1, column: 1 },
          },
        ],
      }),
    });
    expect(result).toEqual([]);
  });

  it("returns diagnostic for template-expanded name when missing", () => {
    const result = checkExportConstants({
      expected: ["${prefix}_CONFIG"],
      context: createMockContext({
        path: "src/index.ts",
        placeholders: { prefix: { toString: () => "APP" } },
      }),
      fileStructure: createMockFileStructure({ exports: [] }),
    });
    expect(result).toHaveLength(1);
    expect(result[0].message).toBe('Missing export constant "APP_CONFIG"');
  });

  it("accepts ExportDefinition object form", () => {
    const result = checkExportConstants({
      expected: [{ name: "MY_CONST" }],
      context: createMockContext({ path: "src/index.ts" }),
      fileStructure: createMockFileStructure({
        exports: [
          {
            name: "MY_CONST",
            kind: "const",
            isType: false,
            pos: { line: 1, column: 1 },
          },
        ],
      }),
    });
    expect(result).toEqual([]);
  });

  it("includes conventionName when provided", () => {
    const result = checkExportConstants({
      expected: ["missing"],
      context: createMockContext({ path: "src/index.ts" }),
      fileStructure: createMockFileStructure({ exports: [] }),
      conventionName: "const-exports",
    });
    expect(result[0].conventionName).toBe("const-exports");
  });

  it("validates a configured constant schema", () => {
    const result = checkExportConstants({
      expected: [
        {
          name: "mode",
          schema: {
            type: "string",
            enum: ["development", "production"],
          },
        },
      ],
      context: createMockContext({ path: "src/index.ts" }),
      fileStructure: parseFileStructure({
        source:
          'export const mode: "development" | "production" = "development";',
      }),
    });
    expect(result).toEqual([]);
  });

  it("validates type references in an object schema", () => {
    const result = checkExportConstants({
      expected: [
        {
          name: "settings",
          schema: {
            type: "object",
            properties: { auth: "${authType}" },
            required: ["auth"],
          },
        },
      ],
      context: createMockContext({
        path: "src/index.ts",
        placeholders: {
          authType: { toString: () => "Readonly<MyAuth>" },
        },
      }),
      fileStructure: parseFileStructure({
        source:
          "export const settings: { auth: Readonly<MyAuth> } = { auth: {} };",
      }),
    });
    expect(result).toEqual([]);
  });

  it("reports an object schema mismatch", () => {
    const result = checkExportConstants({
      expected: [
        {
          name: "options",
          schema: {
            type: "object",
            properties: { endpoint: { type: "string" } },
            required: ["endpoint"],
            additionalProperties: false,
          },
        },
      ],
      context: createMockContext({ path: "src/index.ts" }),
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
      expected: [{ name: "settings", type: "${name}Settings<'public'>" }],
      context: createMockContext({
        path: "src/index.ts",
        placeholders: { name: { toString: () => "Module" } },
      }),
      fileStructure: parseFileStructure({
        source:
          "export const settings: ModuleSettings<'public'> = { enabled: true };",
      }),
    });
    expect(result).toEqual([]);
  });

  it("reports a mismatched exact type annotation", () => {
    const result = checkExportConstants({
      expected: [{ name: "settings", type: "Readonly<ModuleSettings>" }],
      context: createMockContext({ path: "src/index.ts" }),
      fileStructure: parseFileStructure({
        source: "export const settings: ModuleSettings = {};",
      }),
    });
    expect(result[0].message).toBe(
      'Constant "settings" must have type "Readonly<ModuleSettings>"'
    );
  });
});
