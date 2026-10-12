import { describe, expect, it } from "vitest";
import type { PredicateContext } from "../../core/context.js";
import type { FileStructure } from "../types.js";
import { checkExportInterfaces } from "./export-interfaces.js";

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
  interfaces?: FileStructure["interfaces"];
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
    interfaces: opts.interfaces ?? [],
    namedExportSymbols: [],
    nonBarrelStatements: [],
    typeAliases: [],
  };
}

describe("checkExportInterfaces", () => {
  it("returns no diagnostics when interface is exported", () => {
    const result = checkExportInterfaces({
      context: createMockContext({ path: "src/index.ts" }),
      expected: ["MyInterface"],
      fileStructure: createMockFileStructure({
        exports: [
          {
            isType: true,
            kind: "interface",
            name: "MyInterface",
            pos: { column: 1, line: 1 },
          },
        ],
        interfaces: [
          {
            extends: [],
            name: "MyInterface",
            pos: { column: 1, line: 1 },
          },
        ],
      }),
    });
    expect(result).toEqual([]);
  });

  it("returns no diagnostics when extend is satisfied", () => {
    const result = checkExportInterfaces({
      context: createMockContext({ path: "src/index.ts" }),
      expected: [{ extend: "BaseInterface", name: "MyInterface" }],
      fileStructure: createMockFileStructure({
        exports: [
          {
            isType: true,
            kind: "interface",
            name: "MyInterface",
            pos: { column: 1, line: 5 },
          },
        ],
        interfaces: [
          {
            extends: [{ name: "BaseInterface", typeArguments: [] }],
            name: "MyInterface",
            pos: { column: 1, line: 5 },
          },
        ],
      }),
    });
    expect(result).toEqual([]);
  });

  it("returns diagnostic with line number when extend is violated", () => {
    const result = checkExportInterfaces({
      context: createMockContext({ path: "src/index.ts" }),
      expected: [{ extend: "BaseInterface", name: "MyInterface" }],
      fileStructure: createMockFileStructure({
        exports: [
          {
            isType: true,
            kind: "interface",
            name: "MyInterface",
            pos: { column: 3, line: 10 },
          },
        ],
        interfaces: [
          {
            extends: [{ name: "OtherInterface", typeArguments: [] }],
            name: "MyInterface",
            pos: { column: 3, line: 10 },
          },
        ],
      }),
    });
    expect(result).toHaveLength(1);
    expect(result[0].message).toBe(
      'Interface "MyInterface" must extend "BaseInterface"'
    );
    expect(result[0].predicateName).toBe("exportInterfaces");
    expect(result[0].line).toBe(10);
    expect(result[0].column).toBe(3);
  });

  it("returns diagnostic when interface is missing", () => {
    const result = checkExportInterfaces({
      context: createMockContext({ path: "src/index.ts" }),
      expected: ["MissingInterface"],
      fileStructure: createMockFileStructure({
        exports: [],
        interfaces: [],
      }),
    });
    expect(result).toHaveLength(1);
    expect(result[0].message).toBe(
      'Missing export interface "MissingInterface"'
    );
    expect(result[0].predicateName).toBe("exportInterfaces");
    expect(result[0].filePath).toBe("src/index.ts");
    expect(result[0].line).toBeUndefined();
    expect(result[0].column).toBeUndefined();
  });

  it("resolves template placeholders in interface names", () => {
    const result = checkExportInterfaces({
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
        interfaces: [
          {
            extends: [],
            name: "ButtonProps",
            pos: { column: 1, line: 1 },
          },
        ],
      }),
    });
    expect(result).toEqual([]);
  });

  it("resolves template placeholders in extend values", () => {
    const result = checkExportInterfaces({
      context: createMockContext({
        path: "src/index.ts",
        placeholders: { base: { toString: () => "Base" } },
      }),
      expected: [{ extend: "${base}Interface", name: "MyInterface" }],
      fileStructure: createMockFileStructure({
        exports: [
          {
            isType: true,
            kind: "interface",
            name: "MyInterface",
            pos: { column: 1, line: 1 },
          },
        ],
        interfaces: [
          {
            extends: [{ name: "BaseInterface", typeArguments: [] }],
            name: "MyInterface",
            pos: { column: 1, line: 1 },
          },
        ],
      }),
    });
    expect(result).toEqual([]);
  });

  it("includes conventionName when provided", () => {
    const result = checkExportInterfaces({
      context: createMockContext({ path: "src/index.ts" }),
      conventionName: "interface-convention",
      expected: ["Missing"],
      fileStructure: createMockFileStructure({ exports: [], interfaces: [] }),
    });
    expect(result[0].conventionName).toBe("interface-convention");
  });

  it("accepts string shorthand expanding to { name }", () => {
    const result = checkExportInterfaces({
      context: createMockContext({ path: "src/index.ts" }),
      expected: ["Foo"],
      fileStructure: createMockFileStructure({
        exports: [
          {
            isType: true,
            kind: "interface",
            name: "Foo",
            pos: { column: 1, line: 1 },
          },
        ],
        interfaces: [
          {
            extends: [],
            name: "Foo",
            pos: { column: 1, line: 1 },
          },
        ],
      }),
    });
    expect(result).toEqual([]);
  });

  it("returns no diagnostics when allowOmissions is true and interface extends Pick of target", () => {
    const result = checkExportInterfaces({
      context: createMockContext({ path: "src/index.ts" }),
      expected: [
        {
          extend: { allowOmissions: true, type: "BaseInterface" },
          name: "MyInterface",
        },
      ],
      fileStructure: createMockFileStructure({
        exports: [
          {
            isType: true,
            kind: "interface",
            name: "MyInterface",
            pos: { column: 1, line: 1 },
          },
        ],
        interfaces: [
          {
            extends: [
              { name: "Pick", typeArguments: ["BaseInterface", "'a' | 'b'"] },
            ],
            name: "MyInterface",
            pos: { column: 1, line: 1 },
          },
        ],
      }),
    });
    expect(result).toEqual([]);
  });

  it("returns diagnostic when allowOmissions is false and interface extends Pick of target", () => {
    const result = checkExportInterfaces({
      context: createMockContext({ path: "src/index.ts" }),
      expected: [
        {
          extend: { type: "BaseInterface" },
          name: "MyInterface",
        },
      ],
      fileStructure: createMockFileStructure({
        exports: [
          {
            isType: true,
            kind: "interface",
            name: "MyInterface",
            pos: { column: 1, line: 1 },
          },
        ],
        interfaces: [
          {
            extends: [
              { name: "Pick", typeArguments: ["BaseInterface", "'a'"] },
            ],
            name: "MyInterface",
            pos: { column: 1, line: 1 },
          },
        ],
      }),
    });
    expect(result).toHaveLength(1);
    expect(result[0].message).toBe(
      'Interface "MyInterface" must extend "BaseInterface"'
    );
  });

  it("returns no diagnostics when allowOmissions is true and interface extends Omit of target", () => {
    const result = checkExportInterfaces({
      context: createMockContext({ path: "src/index.ts" }),
      expected: [
        {
          extend: { allowOmissions: true, type: "BaseInterface" },
          name: "MyInterface",
        },
      ],
      fileStructure: createMockFileStructure({
        exports: [
          {
            isType: true,
            kind: "interface",
            name: "MyInterface",
            pos: { column: 1, line: 1 },
          },
        ],
        interfaces: [
          {
            extends: [
              { name: "Omit", typeArguments: ["BaseInterface", "'x'"] },
            ],
            name: "MyInterface",
            pos: { column: 1, line: 1 },
          },
        ],
      }),
    });
    expect(result).toEqual([]);
  });

  it("returns no diagnostics when allowOmissions is true and direct match exists", () => {
    const result = checkExportInterfaces({
      context: createMockContext({ path: "src/index.ts" }),
      expected: [
        {
          extend: { allowOmissions: true, type: "BaseInterface" },
          name: "MyInterface",
        },
      ],
      fileStructure: createMockFileStructure({
        exports: [
          {
            isType: true,
            kind: "interface",
            name: "MyInterface",
            pos: { column: 1, line: 1 },
          },
        ],
        interfaces: [
          {
            extends: [{ name: "BaseInterface", typeArguments: [] }],
            name: "MyInterface",
            pos: { column: 1, line: 1 },
          },
        ],
      }),
    });
    expect(result).toEqual([]);
  });

  it("returns diagnostic when allowOmissions is true but target is not referenced", () => {
    const result = checkExportInterfaces({
      context: createMockContext({ path: "src/index.ts" }),
      expected: [
        {
          extend: { allowOmissions: true, type: "BaseInterface" },
          name: "MyInterface",
        },
      ],
      fileStructure: createMockFileStructure({
        exports: [
          {
            isType: true,
            kind: "interface",
            name: "MyInterface",
            pos: { column: 1, line: 1 },
          },
        ],
        interfaces: [
          {
            extends: [
              { name: "Pick", typeArguments: ["OtherInterface", "'a'"] },
            ],
            name: "MyInterface",
            pos: { column: 1, line: 1 },
          },
        ],
      }),
    });
    expect(result).toHaveLength(1);
    expect(result[0].message).toBe(
      'Interface "MyInterface" must extend "BaseInterface"'
    );
  });

  it("resolves template placeholders in extend object type", () => {
    const result = checkExportInterfaces({
      context: createMockContext({
        path: "src/index.ts",
        placeholders: { base: { toString: () => "Base" } },
      }),
      expected: [
        {
          extend: { allowOmissions: true, type: "${base}Interface" },
          name: "MyInterface",
        },
      ],
      fileStructure: createMockFileStructure({
        exports: [
          {
            isType: true,
            kind: "interface",
            name: "MyInterface",
            pos: { column: 1, line: 1 },
          },
        ],
        interfaces: [
          {
            extends: [{ name: "Partial", typeArguments: ["BaseInterface"] }],
            name: "MyInterface",
            pos: { column: 1, line: 1 },
          },
        ],
      }),
    });
    expect(result).toEqual([]);
  });
});
