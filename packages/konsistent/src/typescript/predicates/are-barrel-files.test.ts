import { describe, expect, it } from "vitest";
import type { PredicateContext } from "../../core/context.js";
import type { FileStructure } from "../types.js";
import { checkAreBarrelFiles } from "./are-barrel-files.js";

function createMockContext(opts: { path: string }): PredicateContext {
  return {
    directoryExists: () => false,
    fileExists: () => false,
    path: opts.path,
    placeholders: {} as PredicateContext["placeholders"],
    readDir: () => [],
    resolveTemplate: (t: string) => t,
  };
}

function createMockFileStructure(opts: {
  nonBarrelStatements?: FileStructure["nonBarrelStatements"];
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
    imports: [],
    interfaces: [],
    namedExportSymbols: [],
    nonBarrelStatements: opts.nonBarrelStatements ?? [],
    typeAliases: [],
  };
}

describe("checkAreBarrelFiles", () => {
  it("returns no diagnostics when expected is false", () => {
    const result = checkAreBarrelFiles({
      context: createMockContext({ path: "src/index.ts" }),
      expected: false,
      fileStructure: createMockFileStructure({
        nonBarrelStatements: [
          { kind: "declaration", pos: { column: 1, line: 1 } },
        ],
      }),
    });
    expect(result).toEqual([]);
  });

  it("returns no diagnostics when file has no non-barrel statements", () => {
    const result = checkAreBarrelFiles({
      context: createMockContext({ path: "src/index.ts" }),
      expected: true,
      fileStructure: createMockFileStructure({ nonBarrelStatements: [] }),
    });
    expect(result).toEqual([]);
  });

  it("emits one diagnostic per non-barrel statement", () => {
    const result = checkAreBarrelFiles({
      context: createMockContext({ path: "src/index.ts" }),
      expected: true,
      fileStructure: createMockFileStructure({
        nonBarrelStatements: [
          { kind: "declaration", pos: { column: 1, line: 3 } },
          { kind: "expression", pos: { column: 1, line: 7 } },
        ],
      }),
    });
    expect(result).toHaveLength(2);
    expect(result[0].predicateName).toBe("areBarrelFiles");
    expect(result[0].filePath).toBe("src/index.ts");
    expect(result[0].line).toBe(3);
    expect(result[0].column).toBe(1);
    expect(result[0].message).toBe("Barrel file must not contain declarations");
    expect(result[1].line).toBe(7);
    expect(result[1].message).toBe(
      "Barrel file must not contain top-level expression statements"
    );
  });

  it("uses kind-specific messages for default-expression, named-export-local, and export-equals", () => {
    const result = checkAreBarrelFiles({
      context: createMockContext({ path: "src/index.ts" }),
      expected: true,
      fileStructure: createMockFileStructure({
        nonBarrelStatements: [
          { kind: "default-expression", pos: { column: 1, line: 1 } },
          { kind: "named-export-local", pos: { column: 1, line: 2 } },
          { kind: "export-equals", pos: { column: 1, line: 3 } },
        ],
      }),
    });
    expect(result.map((d) => d.message)).toEqual([
      "Barrel file default export must re-export an imported identifier",
      "Barrel file must only re-export imported identifiers",
      "Barrel file must not use `export =`",
    ]);
  });

  it("includes conventionName when provided", () => {
    const result = checkAreBarrelFiles({
      context: createMockContext({ path: "src/index.ts" }),
      conventionName: "barrel-only",
      expected: true,
      fileStructure: createMockFileStructure({
        nonBarrelStatements: [
          { kind: "declaration", pos: { column: 1, line: 1 } },
        ],
      }),
    });
    expect(result[0].conventionName).toBe("barrel-only");
  });
});
