import { describe, expect, it } from "vitest";
import type { PredicateContext } from "../../core/context.js";
import type { FileStructure } from "../types.js";
import { checkExportClasses } from "./export-classes.js";

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
  classes?: FileStructure["classes"];
}): FileStructure {
  return {
    calls: [],
    classes: (opts.classes ?? []).map((c) => ({
      implements: [],
      ...c,
    })),
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

describe("checkExportClasses", () => {
  it("returns no diagnostics when class is exported", () => {
    const result = checkExportClasses({
      context: createMockContext({ path: "src/index.ts" }),
      expected: ["MyClass"],
      fileStructure: createMockFileStructure({
        classes: [
          {
            name: "MyClass",
            pos: { column: 1, line: 1 },
          },
        ],
        exports: [
          {
            isType: false,
            kind: "class",
            name: "MyClass",
            pos: { column: 1, line: 1 },
          },
        ],
      }),
    });
    expect(result).toEqual([]);
  });

  it("returns no diagnostics when extend is satisfied", () => {
    const result = checkExportClasses({
      context: createMockContext({ path: "src/index.ts" }),
      expected: [{ extend: "BaseClass", name: "MyClass" }],
      fileStructure: createMockFileStructure({
        classes: [
          {
            extends: "BaseClass",
            name: "MyClass",
            pos: { column: 1, line: 5 },
          },
        ],
        exports: [
          {
            isType: false,
            kind: "class",
            name: "MyClass",
            pos: { column: 1, line: 5 },
          },
        ],
      }),
    });
    expect(result).toEqual([]);
  });

  it("returns diagnostic with line number when extend is violated", () => {
    const result = checkExportClasses({
      context: createMockContext({ path: "src/index.ts" }),
      expected: [{ extend: "BaseClass", name: "MyClass" }],
      fileStructure: createMockFileStructure({
        classes: [
          {
            extends: "OtherClass",
            name: "MyClass",
            pos: { column: 3, line: 10 },
          },
        ],
        exports: [
          {
            isType: false,
            kind: "class",
            name: "MyClass",
            pos: { column: 3, line: 10 },
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
      context: createMockContext({ path: "src/index.ts" }),
      expected: ["MissingClass"],
      fileStructure: createMockFileStructure({
        classes: [],
        exports: [],
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
      context: createMockContext({
        path: "src/index.ts",
        placeholders: { name: { toString: () => "User" } },
      }),
      expected: ["${name}Controller"],
      fileStructure: createMockFileStructure({
        classes: [
          {
            name: "UserController",
            pos: { column: 1, line: 1 },
          },
        ],
        exports: [
          {
            isType: false,
            kind: "class",
            name: "UserController",
            pos: { column: 1, line: 1 },
          },
        ],
      }),
    });
    expect(result).toEqual([]);
  });

  it("resolves template placeholders in extend values", () => {
    const result = checkExportClasses({
      context: createMockContext({
        path: "src/index.ts",
        placeholders: { base: { toString: () => "Base" } },
      }),
      expected: [{ extend: "${base}Class", name: "MyClass" }],
      fileStructure: createMockFileStructure({
        classes: [
          {
            extends: "BaseClass",
            name: "MyClass",
            pos: { column: 1, line: 1 },
          },
        ],
        exports: [
          {
            isType: false,
            kind: "class",
            name: "MyClass",
            pos: { column: 1, line: 1 },
          },
        ],
      }),
    });
    expect(result).toEqual([]);
  });

  it("includes conventionName when provided", () => {
    const result = checkExportClasses({
      context: createMockContext({ path: "src/index.ts" }),
      conventionName: "class-convention",
      expected: ["Missing"],
      fileStructure: createMockFileStructure({ classes: [], exports: [] }),
    });
    expect(result[0].conventionName).toBe("class-convention");
  });

  it("accepts string shorthand expanding to { name }", () => {
    const result = checkExportClasses({
      context: createMockContext({ path: "src/index.ts" }),
      expected: ["Foo"],
      fileStructure: createMockFileStructure({
        classes: [
          {
            name: "Foo",
            pos: { column: 1, line: 1 },
          },
        ],
        exports: [
          {
            isType: false,
            kind: "class",
            name: "Foo",
            pos: { column: 1, line: 1 },
          },
        ],
      }),
    });
    expect(result).toEqual([]);
  });

  it("accepts object form for extend with type field", () => {
    const result = checkExportClasses({
      context: createMockContext({ path: "src/index.ts" }),
      expected: [{ extend: { type: "BaseClass" }, name: "MyClass" }],
      fileStructure: createMockFileStructure({
        classes: [
          {
            extends: "BaseClass",
            name: "MyClass",
            pos: { column: 1, line: 1 },
          },
        ],
        exports: [
          {
            isType: false,
            kind: "class",
            name: "MyClass",
            pos: { column: 1, line: 1 },
          },
        ],
      }),
    });
    expect(result).toEqual([]);
  });

  it("returns no diagnostics when implement is satisfied", () => {
    const result = checkExportClasses({
      context: createMockContext({ path: "src/index.ts" }),
      expected: [{ implement: ["Serializable"], name: "MyClass" }],
      fileStructure: createMockFileStructure({
        classes: [
          {
            implements: ["Serializable"],
            name: "MyClass",
            pos: { column: 1, line: 1 },
          },
        ],
        exports: [
          {
            isType: false,
            kind: "class",
            name: "MyClass",
            pos: { column: 1, line: 1 },
          },
        ],
      }),
    });
    expect(result).toEqual([]);
  });

  it("returns no diagnostics when multiple implements are satisfied", () => {
    const result = checkExportClasses({
      context: createMockContext({ path: "src/index.ts" }),
      expected: [
        { implement: ["Serializable", "Disposable"], name: "MyClass" },
      ],
      fileStructure: createMockFileStructure({
        classes: [
          {
            implements: ["Serializable", "Disposable"],
            name: "MyClass",
            pos: { column: 1, line: 1 },
          },
        ],
        exports: [
          {
            isType: false,
            kind: "class",
            name: "MyClass",
            pos: { column: 1, line: 1 },
          },
        ],
      }),
    });
    expect(result).toEqual([]);
  });

  it("returns diagnostic when implement is violated", () => {
    const result = checkExportClasses({
      context: createMockContext({ path: "src/index.ts" }),
      expected: [{ implement: ["Serializable"], name: "MyClass" }],
      fileStructure: createMockFileStructure({
        classes: [
          {
            implements: [],
            name: "MyClass",
            pos: { column: 1, line: 5 },
          },
        ],
        exports: [
          {
            isType: false,
            kind: "class",
            name: "MyClass",
            pos: { column: 1, line: 5 },
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
      context: createMockContext({ path: "src/index.ts" }),
      expected: [
        { implement: ["Serializable", "Disposable"], name: "MyClass" },
      ],
      fileStructure: createMockFileStructure({
        classes: [
          {
            implements: ["Serializable"],
            name: "MyClass",
            pos: { column: 1, line: 1 },
          },
        ],
        exports: [
          {
            isType: false,
            kind: "class",
            name: "MyClass",
            pos: { column: 1, line: 1 },
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
      context: createMockContext({
        path: "src/index.ts",
        placeholders: { name: { toString: () => "Event" } },
      }),
      expected: [{ implement: ["${name}Handler"], name: "MyClass" }],
      fileStructure: createMockFileStructure({
        classes: [
          {
            implements: ["EventHandler"],
            name: "MyClass",
            pos: { column: 1, line: 1 },
          },
        ],
        exports: [
          {
            isType: false,
            kind: "class",
            name: "MyClass",
            pos: { column: 1, line: 1 },
          },
        ],
      }),
    });
    expect(result).toEqual([]);
  });

  it("accepts object form for implement with type field", () => {
    const result = checkExportClasses({
      context: createMockContext({ path: "src/index.ts" }),
      expected: [{ implement: [{ type: "Serializable" }], name: "MyClass" }],
      fileStructure: createMockFileStructure({
        classes: [
          {
            implements: ["Serializable"],
            name: "MyClass",
            pos: { column: 1, line: 1 },
          },
        ],
        exports: [
          {
            isType: false,
            kind: "class",
            name: "MyClass",
            pos: { column: 1, line: 1 },
          },
        ],
      }),
    });
    expect(result).toEqual([]);
  });
});
