import { describe, expect, it } from "vitest";
import type { PredicateContext } from "../../core/context.js";
import type { FileStructure } from "../types.js";
import { checkExportClasses } from "./export-classes.js";

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
  classes?: FileStructure["classes"];
}): FileStructure {
  return {
    exports: opts.exports ?? [],
    imports: [],
    interfaces: [],
    classes: (opts.classes ?? []).map((c) => ({
      implements: [],
      ...c,
    })),
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

describe("checkExportClasses", () => {
  it("returns no diagnostics when class is exported", () => {
    const result = checkExportClasses({
      expected: ["MyClass"],
      context: createMockContext({ path: "src/index.ts" }),
      fileStructure: createMockFileStructure({
        exports: [
          {
            name: "MyClass",
            kind: "class",
            isType: false,
            pos: { line: 1, column: 1 },
          },
        ],
        classes: [
          {
            name: "MyClass",
            pos: { line: 1, column: 1 },
          },
        ],
      }),
    });
    expect(result).toEqual([]);
  });

  it("returns no diagnostics when extend is satisfied", () => {
    const result = checkExportClasses({
      expected: [{ name: "MyClass", extend: "BaseClass" }],
      context: createMockContext({ path: "src/index.ts" }),
      fileStructure: createMockFileStructure({
        exports: [
          {
            name: "MyClass",
            kind: "class",
            isType: false,
            pos: { line: 5, column: 1 },
          },
        ],
        classes: [
          {
            name: "MyClass",
            extends: "BaseClass",
            pos: { line: 5, column: 1 },
          },
        ],
      }),
    });
    expect(result).toEqual([]);
  });

  it("returns diagnostic with line number when extend is violated", () => {
    const result = checkExportClasses({
      expected: [{ name: "MyClass", extend: "BaseClass" }],
      context: createMockContext({ path: "src/index.ts" }),
      fileStructure: createMockFileStructure({
        exports: [
          {
            name: "MyClass",
            kind: "class",
            isType: false,
            pos: { line: 10, column: 3 },
          },
        ],
        classes: [
          {
            name: "MyClass",
            extends: "OtherClass",
            pos: { line: 10, column: 3 },
          },
        ],
      }),
    });
    expect(result).toHaveLength(1);
    expect(result[0].message).toBe('Class "MyClass" must extend "BaseClass"');
    expect(result[0].predicateName).toBe("exportClasses");
    expect(result[0].line).toBe(10);
    expect(result[0].column).toBe(3);
  });

  it("returns diagnostic when class is missing", () => {
    const result = checkExportClasses({
      expected: ["MissingClass"],
      context: createMockContext({ path: "src/index.ts" }),
      fileStructure: createMockFileStructure({
        exports: [],
        classes: [],
      }),
    });
    expect(result).toHaveLength(1);
    expect(result[0].message).toBe('Missing export class "MissingClass"');
    expect(result[0].predicateName).toBe("exportClasses");
    expect(result[0].filePath).toBe("src/index.ts");
    expect(result[0].line).toBeUndefined();
    expect(result[0].column).toBeUndefined();
  });

  it("resolves template placeholders in class names", () => {
    const result = checkExportClasses({
      expected: ["${name}Controller"],
      context: createMockContext({
        path: "src/index.ts",
        placeholders: { name: { toString: () => "User" } },
      }),
      fileStructure: createMockFileStructure({
        exports: [
          {
            name: "UserController",
            kind: "class",
            isType: false,
            pos: { line: 1, column: 1 },
          },
        ],
        classes: [
          {
            name: "UserController",
            pos: { line: 1, column: 1 },
          },
        ],
      }),
    });
    expect(result).toEqual([]);
  });

  it("resolves template placeholders in extend values", () => {
    const result = checkExportClasses({
      expected: [{ name: "MyClass", extend: "${base}Class" }],
      context: createMockContext({
        path: "src/index.ts",
        placeholders: { base: { toString: () => "Base" } },
      }),
      fileStructure: createMockFileStructure({
        exports: [
          {
            name: "MyClass",
            kind: "class",
            isType: false,
            pos: { line: 1, column: 1 },
          },
        ],
        classes: [
          {
            name: "MyClass",
            extends: "BaseClass",
            pos: { line: 1, column: 1 },
          },
        ],
      }),
    });
    expect(result).toEqual([]);
  });

  it("includes conventionName when provided", () => {
    const result = checkExportClasses({
      expected: ["Missing"],
      context: createMockContext({ path: "src/index.ts" }),
      fileStructure: createMockFileStructure({ exports: [], classes: [] }),
      conventionName: "class-convention",
    });
    expect(result[0].conventionName).toBe("class-convention");
  });

  it("accepts string shorthand expanding to { name }", () => {
    const result = checkExportClasses({
      expected: ["Foo"],
      context: createMockContext({ path: "src/index.ts" }),
      fileStructure: createMockFileStructure({
        exports: [
          {
            name: "Foo",
            kind: "class",
            isType: false,
            pos: { line: 1, column: 1 },
          },
        ],
        classes: [
          {
            name: "Foo",
            pos: { line: 1, column: 1 },
          },
        ],
      }),
    });
    expect(result).toEqual([]);
  });

  it("accepts object form for extend with type field", () => {
    const result = checkExportClasses({
      expected: [{ name: "MyClass", extend: { type: "BaseClass" } }],
      context: createMockContext({ path: "src/index.ts" }),
      fileStructure: createMockFileStructure({
        exports: [
          {
            name: "MyClass",
            kind: "class",
            isType: false,
            pos: { line: 1, column: 1 },
          },
        ],
        classes: [
          {
            name: "MyClass",
            extends: "BaseClass",
            pos: { line: 1, column: 1 },
          },
        ],
      }),
    });
    expect(result).toEqual([]);
  });

  it("returns no diagnostics when implement is satisfied", () => {
    const result = checkExportClasses({
      expected: [{ name: "MyClass", implement: ["Serializable"] }],
      context: createMockContext({ path: "src/index.ts" }),
      fileStructure: createMockFileStructure({
        exports: [
          {
            name: "MyClass",
            kind: "class",
            isType: false,
            pos: { line: 1, column: 1 },
          },
        ],
        classes: [
          {
            name: "MyClass",
            implements: ["Serializable"],
            pos: { line: 1, column: 1 },
          },
        ],
      }),
    });
    expect(result).toEqual([]);
  });

  it("returns no diagnostics when multiple implements are satisfied", () => {
    const result = checkExportClasses({
      expected: [
        { name: "MyClass", implement: ["Serializable", "Disposable"] },
      ],
      context: createMockContext({ path: "src/index.ts" }),
      fileStructure: createMockFileStructure({
        exports: [
          {
            name: "MyClass",
            kind: "class",
            isType: false,
            pos: { line: 1, column: 1 },
          },
        ],
        classes: [
          {
            name: "MyClass",
            implements: ["Serializable", "Disposable"],
            pos: { line: 1, column: 1 },
          },
        ],
      }),
    });
    expect(result).toEqual([]);
  });

  it("returns diagnostic when implement is violated", () => {
    const result = checkExportClasses({
      expected: [{ name: "MyClass", implement: ["Serializable"] }],
      context: createMockContext({ path: "src/index.ts" }),
      fileStructure: createMockFileStructure({
        exports: [
          {
            name: "MyClass",
            kind: "class",
            isType: false,
            pos: { line: 5, column: 1 },
          },
        ],
        classes: [
          {
            name: "MyClass",
            implements: [],
            pos: { line: 5, column: 1 },
          },
        ],
      }),
    });
    expect(result).toHaveLength(1);
    expect(result[0].message).toBe(
      'Class "MyClass" must implement "Serializable"'
    );
    expect(result[0].line).toBe(5);
  });

  it("returns diagnostics for each missing implement", () => {
    const result = checkExportClasses({
      expected: [
        { name: "MyClass", implement: ["Serializable", "Disposable"] },
      ],
      context: createMockContext({ path: "src/index.ts" }),
      fileStructure: createMockFileStructure({
        exports: [
          {
            name: "MyClass",
            kind: "class",
            isType: false,
            pos: { line: 1, column: 1 },
          },
        ],
        classes: [
          {
            name: "MyClass",
            implements: ["Serializable"],
            pos: { line: 1, column: 1 },
          },
        ],
      }),
    });
    expect(result).toHaveLength(1);
    expect(result[0].message).toBe(
      'Class "MyClass" must implement "Disposable"'
    );
  });

  it("resolves template placeholders in implement values", () => {
    const result = checkExportClasses({
      expected: [{ name: "MyClass", implement: ["${name}Handler"] }],
      context: createMockContext({
        path: "src/index.ts",
        placeholders: { name: { toString: () => "Event" } },
      }),
      fileStructure: createMockFileStructure({
        exports: [
          {
            name: "MyClass",
            kind: "class",
            isType: false,
            pos: { line: 1, column: 1 },
          },
        ],
        classes: [
          {
            name: "MyClass",
            implements: ["EventHandler"],
            pos: { line: 1, column: 1 },
          },
        ],
      }),
    });
    expect(result).toEqual([]);
  });

  it("accepts object form for implement with type field", () => {
    const result = checkExportClasses({
      expected: [{ name: "MyClass", implement: [{ type: "Serializable" }] }],
      context: createMockContext({ path: "src/index.ts" }),
      fileStructure: createMockFileStructure({
        exports: [
          {
            name: "MyClass",
            kind: "class",
            isType: false,
            pos: { line: 1, column: 1 },
          },
        ],
        classes: [
          {
            name: "MyClass",
            implements: ["Serializable"],
            pos: { line: 1, column: 1 },
          },
        ],
      }),
    });
    expect(result).toEqual([]);
  });
});
