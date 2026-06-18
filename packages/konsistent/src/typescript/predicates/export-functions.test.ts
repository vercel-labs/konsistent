import { describe, expect, it } from "vitest";
import type { PredicateContext } from "../../core/context.js";
import type { FileStructure } from "../types.js";
import { checkExportFunctions } from "./export-functions.js";

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
  functions?: FileStructure["functions"];
}): FileStructure {
  return {
    exports: opts.exports ?? [],
    imports: [],
    interfaces: [],
    classes: [],
    functions: opts.functions ?? [],
    constants: [],
    declarationSymbols: [],
    defaultExportSymbols: [],
    importSources: [],
    namedExportSymbols: [],
    nonBarrelStatements: [],
    typeAliases: [],
  };
}

describe("checkExportFunctions", () => {
  it("returns no diagnostics when exported function is found", () => {
    const result = checkExportFunctions({
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
        functions: [
          {
            name: "myFunc",
            params: [],
            pos: { line: 1, column: 1 },
          },
        ],
      }),
    });
    expect(result).toEqual([]);
  });

  it("returns diagnostic when function is missing", () => {
    const result = checkExportFunctions({
      expected: ["myFunc"],
      context: createMockContext({ path: "src/index.ts" }),
      fileStructure: createMockFileStructure({ exports: [], functions: [] }),
    });
    expect(result).toHaveLength(1);
    expect(result[0].message).toBe('Missing export function "myFunc"');
    expect(result[0].predicateName).toBe("exportFunctions");
    expect(result[0].filePath).toBe("src/index.ts");
    expect(result[0].line).toBeUndefined();
  });

  it("returns diagnostic when function exists but is not exported", () => {
    const result = checkExportFunctions({
      expected: ["myFunc"],
      context: createMockContext({ path: "src/index.ts" }),
      fileStructure: createMockFileStructure({
        exports: [],
        functions: [
          {
            name: "myFunc",
            params: [],
            pos: { line: 5, column: 1 },
          },
        ],
      }),
    });
    expect(result).toHaveLength(1);
    expect(result[0].message).toBe('Missing export function "myFunc"');
  });

  it("returns diagnostic when param type does not match", () => {
    const result = checkExportFunctions({
      expected: [{ name: "myFunc", receiveParamOfType: "Request" }],
      context: createMockContext({ path: "src/index.ts" }),
      fileStructure: createMockFileStructure({
        exports: [
          {
            name: "myFunc",
            kind: "function",
            isType: false,
            pos: { line: 3, column: 1 },
          },
        ],
        functions: [
          {
            name: "myFunc",
            params: [
              {
                name: "input",
                typeName: { text: "string", baseName: "string" },
              },
            ],
            pos: { line: 3, column: 1 },
          },
        ],
      }),
    });
    expect(result).toHaveLength(1);
    expect(result[0].message).toBe(
      'Function "myFunc" must receive a parameter of type "Request"'
    );
    expect(result[0].line).toBe(3);
  });

  it("returns no diagnostic when param type matches", () => {
    const result = checkExportFunctions({
      expected: [{ name: "myFunc", receiveParamOfType: "Request" }],
      context: createMockContext({ path: "src/index.ts" }),
      fileStructure: createMockFileStructure({
        exports: [
          {
            name: "myFunc",
            kind: "function",
            isType: false,
            pos: { line: 3, column: 1 },
          },
        ],
        functions: [
          {
            name: "myFunc",
            params: [
              {
                name: "req",
                typeName: { text: "Request", baseName: "Request" },
              },
            ],
            pos: { line: 3, column: 1 },
          },
        ],
      }),
    });
    expect(result).toEqual([]);
  });

  it("returns diagnostic when return type does not match", () => {
    const result = checkExportFunctions({
      expected: [{ name: "myFunc", returnValueOfType: "Promise<Response>" }],
      context: createMockContext({ path: "src/index.ts" }),
      fileStructure: createMockFileStructure({
        exports: [
          {
            name: "myFunc",
            kind: "function",
            isType: false,
            pos: { line: 7, column: 1 },
          },
        ],
        functions: [
          {
            name: "myFunc",
            params: [],
            returnType: { text: "void", baseName: "void" },
            pos: { line: 7, column: 1 },
          },
        ],
      }),
    });
    expect(result).toHaveLength(1);
    expect(result[0].message).toBe(
      'Function "myFunc" must return value of type "Promise<Response>"'
    );
    expect(result[0].line).toBe(7);
  });

  it("returns no diagnostic when return type matches", () => {
    const result = checkExportFunctions({
      expected: [{ name: "myFunc", returnValueOfType: "void" }],
      context: createMockContext({ path: "src/index.ts" }),
      fileStructure: createMockFileStructure({
        exports: [
          {
            name: "myFunc",
            kind: "function",
            isType: false,
            pos: { line: 7, column: 1 },
          },
        ],
        functions: [
          {
            name: "myFunc",
            params: [],
            returnType: { text: "void", baseName: "void" },
            pos: { line: 7, column: 1 },
          },
        ],
      }),
    });
    expect(result).toEqual([]);
  });

  it("returns no diagnostic when bare config matches generic return type", () => {
    const result = checkExportFunctions({
      expected: [{ name: "myFunc", returnValueOfType: "MyClass" }],
      context: createMockContext({ path: "src/index.ts" }),
      fileStructure: createMockFileStructure({
        exports: [
          {
            name: "myFunc",
            kind: "function",
            isType: false,
            pos: { line: 7, column: 1 },
          },
        ],
        functions: [
          {
            name: "myFunc",
            params: [],
            returnType: { text: "MyClass<Foo>", baseName: "MyClass" },
            pos: { line: 7, column: 1 },
          },
        ],
      }),
    });
    expect(result).toEqual([]);
  });

  it("returns no diagnostic when bare config matches generic param type", () => {
    const result = checkExportFunctions({
      expected: [{ name: "myFunc", receiveParamOfType: "MyClass" }],
      context: createMockContext({ path: "src/index.ts" }),
      fileStructure: createMockFileStructure({
        exports: [
          {
            name: "myFunc",
            kind: "function",
            isType: false,
            pos: { line: 3, column: 1 },
          },
        ],
        functions: [
          {
            name: "myFunc",
            params: [
              {
                name: "value",
                typeName: { text: "MyClass<Foo>", baseName: "MyClass" },
              },
            ],
            pos: { line: 3, column: 1 },
          },
        ],
      }),
    });
    expect(result).toEqual([]);
  });

  it("preserves exact match when configured return type has generics", () => {
    const result = checkExportFunctions({
      expected: [{ name: "myFunc", returnValueOfType: "Promise<void>" }],
      context: createMockContext({ path: "src/index.ts" }),
      fileStructure: createMockFileStructure({
        exports: [
          {
            name: "myFunc",
            kind: "function",
            isType: false,
            pos: { line: 7, column: 1 },
          },
        ],
        functions: [
          {
            name: "myFunc",
            params: [],
            returnType: { text: "Promise<string>", baseName: "Promise" },
            pos: { line: 7, column: 1 },
          },
        ],
      }),
    });
    expect(result).toHaveLength(1);
    expect(result[0].message).toBe(
      'Function "myFunc" must return value of type "Promise<void>"'
    );
  });

  it("resolves template placeholders in name, param type, and return type", () => {
    const result = checkExportFunctions({
      expected: [
        {
          name: "${action}Handler",
          receiveParamOfType: "${action}Request",
          returnValueOfType: "${action}Response",
        },
      ],
      context: createMockContext({
        path: "src/index.ts",
        placeholders: { action: { toString: () => "Create" } },
      }),
      fileStructure: createMockFileStructure({
        exports: [
          {
            name: "CreateHandler",
            kind: "function",
            isType: false,
            pos: { line: 1, column: 1 },
          },
        ],
        functions: [
          {
            name: "CreateHandler",
            params: [
              {
                name: "req",
                typeName: { text: "CreateRequest", baseName: "CreateRequest" },
              },
            ],
            returnType: {
              text: "CreateResponse",
              baseName: "CreateResponse",
            },
            pos: { line: 1, column: 1 },
          },
        ],
      }),
    });
    expect(result).toEqual([]);
  });

  it("accepts string shorthand expanding to { name }", () => {
    const result = checkExportFunctions({
      expected: ["handler"],
      context: createMockContext({ path: "src/index.ts" }),
      fileStructure: createMockFileStructure({
        exports: [
          {
            name: "handler",
            kind: "function",
            isType: false,
            pos: { line: 1, column: 1 },
          },
        ],
        functions: [
          {
            name: "handler",
            params: [],
            pos: { line: 1, column: 1 },
          },
        ],
      }),
    });
    expect(result).toEqual([]);
  });

  it("includes conventionName when provided", () => {
    const result = checkExportFunctions({
      expected: ["missing"],
      context: createMockContext({ path: "src/index.ts" }),
      fileStructure: createMockFileStructure({ exports: [], functions: [] }),
      conventionName: "func-exports",
    });
    expect(result[0].conventionName).toBe("func-exports");
  });
});
