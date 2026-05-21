import { describe, expect, it } from "vitest";
import type { PredicateContext } from "../../core/context.js";
import type { FileStructure } from "../types.js";
import { checkAreBarrelFiles } from "./are-barrel-files.js";

function createMockContext(opts: { path: string }): PredicateContext {
  return {
    path: opts.path,
    placeholders: {} as PredicateContext["placeholders"],
    resolveTemplate: (t: string) => t,
    fileExists: () => false,
    readDir: () => [],
  };
}

function createMockFileStructure(opts: {
  nonBarrelStatements?: FileStructure["nonBarrelStatements"];
}): FileStructure {
  return {
    exports: [],
    imports: [],
    interfaces: [],
    classes: [],
    functions: [],
    constants: [],
    nonBarrelStatements: opts.nonBarrelStatements ?? [],
    typeAliases: [],
  };
}

describe("checkAreBarrelFiles", () => {
  it("returns no diagnostics when expected is false", () => {
    const result = checkAreBarrelFiles({
      expected: false,
      context: createMockContext({ path: "src/index.ts" }),
      fileStructure: createMockFileStructure({
        nonBarrelStatements: [
          { kind: "declaration", pos: { line: 1, column: 1 } },
        ],
      }),
    });
    expect(result).toEqual([]);
  });

  it("returns no diagnostics when file has no non-barrel statements", () => {
    const result = checkAreBarrelFiles({
      expected: true,
      context: createMockContext({ path: "src/index.ts" }),
      fileStructure: createMockFileStructure({ nonBarrelStatements: [] }),
    });
    expect(result).toEqual([]);
  });

  it("emits one diagnostic per non-barrel statement", () => {
    const result = checkAreBarrelFiles({
      expected: true,
      context: createMockContext({ path: "src/index.ts" }),
      fileStructure: createMockFileStructure({
        nonBarrelStatements: [
          { kind: "declaration", pos: { line: 3, column: 1 } },
          { kind: "expression", pos: { line: 7, column: 1 } },
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
      expected: true,
      context: createMockContext({ path: "src/index.ts" }),
      fileStructure: createMockFileStructure({
        nonBarrelStatements: [
          { kind: "default-expression", pos: { line: 1, column: 1 } },
          { kind: "named-export-local", pos: { line: 2, column: 1 } },
          { kind: "export-equals", pos: { line: 3, column: 1 } },
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
      expected: true,
      context: createMockContext({ path: "src/index.ts" }),
      fileStructure: createMockFileStructure({
        nonBarrelStatements: [
          { kind: "declaration", pos: { line: 1, column: 1 } },
        ],
      }),
      conventionName: "barrel-only",
    });
    expect(result[0].conventionName).toBe("barrel-only");
  });
});
