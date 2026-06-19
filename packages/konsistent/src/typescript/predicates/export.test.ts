import { describe, expect, it } from "vitest";
import type { PredicateContext } from "../../core/context.js";
import type { FileStructure } from "../types.js";
import { checkExport } from "./export.js";

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

describe("checkExport", () => {
  it("returns no diagnostics when export is found", () => {
    const result = checkExport({
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
    const result = checkExport({
      expected: ["missingExport"],
      context: createMockContext({ path: "src/index.ts" }),
      fileStructure: createMockFileStructure({ exports: [] }),
    });
    expect(result).toHaveLength(1);
    expect(result[0].message).toBe('Missing export "missingExport"');
    expect(result[0].predicateName).toBe("export");
    expect(result[0].filePath).toBe("src/index.ts");
    expect(result[0].line).toBeUndefined();
    expect(result[0].column).toBeUndefined();
  });

  it("resolves template placeholders in export names", () => {
    const result = checkExport({
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
    const result = checkExport({
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
    const result = checkExport({
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
    const result = checkExport({
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
    const result = checkExport({
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
    const result = checkExport({
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
    const result = checkExport({
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
    const result = checkExport({
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

  it("includes conventionName when provided", () => {
    const result = checkExport({
      expected: ["missing"],
      context: createMockContext({ path: "src/index.ts" }),
      fileStructure: createMockFileStructure({ exports: [] }),
      conventionName: "barrel-exports",
    });
    expect(result[0].conventionName).toBe("barrel-exports");
  });
});
