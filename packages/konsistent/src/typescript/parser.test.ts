import { describe, expect, it } from "vitest";
import { parseFileStructure } from "./parser.js";

describe("parseFileStructure", () => {
  describe("exports", () => {
    it("extracts exported function declarations", () => {
      const result = parseFileStructure({
        source: "export function greet(name: string): string { return name; }",
      });
      expect(result.exports).toHaveLength(1);
      expect(result.exports[0]).toMatchObject({
        name: "greet",
        kind: "function",
        isType: false,
      });
    });

    it("extracts exported class declarations", () => {
      const result = parseFileStructure({
        source: "export class MyClass {}",
      });
      expect(result.exports).toHaveLength(1);
      expect(result.exports[0]).toMatchObject({
        name: "MyClass",
        kind: "class",
        isType: false,
      });
    });

    it("extracts exported interface declarations", () => {
      const result = parseFileStructure({
        source: "export interface MyInterface { foo: string; }",
      });
      expect(result.exports).toHaveLength(1);
      expect(result.exports[0]).toMatchObject({
        name: "MyInterface",
        kind: "interface",
        isType: true,
      });
    });

    it("extracts exported const declarations", () => {
      const result = parseFileStructure({
        source: "export const value: number = 42;",
      });
      expect(result.exports).toHaveLength(1);
      expect(result.exports[0]).toMatchObject({
        name: "value",
        kind: "const",
        isType: false,
      });
    });

    it("extracts exported enum declarations", () => {
      const result = parseFileStructure({
        source: "export enum Direction { Up, Down, Left, Right }",
      });
      expect(result.exports).toHaveLength(1);
      expect(result.exports[0]).toMatchObject({
        name: "Direction",
        kind: "enum",
        isType: false,
      });
    });

    it("extracts named re-exports without from", () => {
      const source = [
        "const foo = 1;",
        "const bar = 2;",
        "export { foo, bar };",
      ].join("\n");
      const result = parseFileStructure({ source });
      expect(result.exports).toHaveLength(2);
      expect(result.exports[0]).toMatchObject({
        name: "foo",
        kind: "re-export",
        isType: false,
      });
      expect(result.exports[0].from).toBeUndefined();
      expect(result.exports[1]).toMatchObject({
        name: "bar",
        kind: "re-export",
        isType: false,
      });
    });

    it("extracts re-exports with from", () => {
      const result = parseFileStructure({
        source: "export { foo, bar } from './module';",
      });
      expect(result.exports).toHaveLength(2);
      expect(result.exports[0]).toMatchObject({
        name: "foo",
        kind: "re-export",
        from: "./module",
        isType: false,
      });
    });

    it("extracts type exports", () => {
      const result = parseFileStructure({
        source: "export type { Foo } from './types';",
      });
      expect(result.exports).toHaveLength(1);
      expect(result.exports[0]).toMatchObject({
        name: "Foo",
        kind: "re-export",
        from: "./types",
        isType: true,
      });
    });

    it("extracts individual type exports in named export", () => {
      const result = parseFileStructure({
        source: "export { type Foo, bar } from './module';",
      });
      expect(result.exports).toHaveLength(2);
      expect(result.exports[0]).toMatchObject({
        name: "Foo",
        isType: true,
      });
      expect(result.exports[1]).toMatchObject({
        name: "bar",
        isType: false,
      });
    });

    it("extracts star re-exports", () => {
      const result = parseFileStructure({
        source: "export * from './everything';",
      });
      expect(result.exports).toHaveLength(1);
      expect(result.exports[0]).toMatchObject({
        name: "*",
        kind: "re-export",
        from: "./everything",
      });
    });

    it("extracts default export", () => {
      const result = parseFileStructure({
        source: "export default function() {}",
      });
      expect(result.exports).toHaveLength(1);
      expect(result.exports[0]).toMatchObject({
        name: "default",
        isType: false,
      });
    });

    it("extracts exported type alias declarations", () => {
      const result = parseFileStructure({
        source: "export type MyType = string | number;",
      });
      expect(result.exports).toHaveLength(1);
      expect(result.exports[0]).toMatchObject({
        name: "MyType",
        kind: "interface",
        isType: true,
      });
    });
  });

  describe("imports", () => {
    it("extracts named imports", () => {
      const result = parseFileStructure({
        source: "import { foo, bar } from 'module';",
      });
      expect(result.imports).toHaveLength(2);
      expect(result.imports[0]).toMatchObject({
        name: "foo",
        from: "module",
        isType: false,
      });
      expect(result.imports[1]).toMatchObject({
        name: "bar",
        from: "module",
        isType: false,
      });
    });

    it("extracts type imports", () => {
      const result = parseFileStructure({
        source: "import type { Foo } from 'module';",
      });
      expect(result.imports).toHaveLength(1);
      expect(result.imports[0]).toMatchObject({
        name: "Foo",
        from: "module",
        isType: true,
      });
    });

    it("extracts individual type imports", () => {
      const result = parseFileStructure({
        source: "import { type Foo, bar } from 'module';",
      });
      expect(result.imports).toHaveLength(2);
      expect(result.imports[0]).toMatchObject({
        name: "Foo",
        isType: true,
      });
      expect(result.imports[1]).toMatchObject({
        name: "bar",
        isType: false,
      });
    });

    it("extracts namespace imports", () => {
      const result = parseFileStructure({
        source: "import * as ns from 'module';",
      });
      expect(result.imports).toHaveLength(1);
      expect(result.imports[0]).toMatchObject({
        name: "ns",
        from: "module",
        isType: false,
      });
    });

    it("extracts default imports", () => {
      const result = parseFileStructure({
        source: "import DefaultExport from 'module';",
      });
      expect(result.imports).toHaveLength(1);
      expect(result.imports[0]).toMatchObject({
        name: "DefaultExport",
        from: "module",
        isType: false,
      });
    });

    it("extracts side-effect import sources", () => {
      const result = parseFileStructure({
        source: "import './setup';",
      });
      expect(result.imports).toHaveLength(0);
      expect(result.importSources).toEqual([
        {
          from: "./setup",
          isType: false,
          pos: { line: 1, column: 1 },
        },
      ]);
    });

    it("marks import type clauses as type import sources", () => {
      const result = parseFileStructure({
        source: "import type { Foo } from './types';",
      });
      expect(result.importSources).toEqual([
        {
          from: "./types",
          isType: true,
          pos: { line: 1, column: 1 },
        },
      ]);
    });

    it("marks individual type specifiers as type import sources", () => {
      const result = parseFileStructure({
        source: "import { type Foo } from './types';",
      });
      expect(result.importSources).toEqual([
        {
          from: "./types",
          isType: true,
          pos: { line: 1, column: 1 },
        },
      ]);
    });

    it("marks mixed imports as value and type import sources", () => {
      const result = parseFileStructure({
        source: "import { type Foo, bar } from './module';",
      });
      expect(result.importSources).toEqual([
        {
          from: "./module",
          isType: false,
          pos: { line: 1, column: 1 },
        },
        {
          from: "./module",
          isType: true,
          pos: { line: 1, column: 1 },
        },
      ]);
    });
  });

  describe("declaration symbols", () => {
    it("extracts local declaration symbols", () => {
      const result = parseFileStructure({
        source: [
          "function makeThing() {}",
          "class Thing {}",
          "interface ThingConfig {}",
          "type ThingInput = string;",
          "const thingId = 'thing';",
          "enum ThingKind { A }",
        ].join("\n"),
      });
      expect(result.declarationSymbols.map((symbol) => symbol.kind)).toEqual([
        "function",
        "class",
        "interface",
        "type",
        "const",
        "enum",
      ]);
      expect(result.declarationSymbols.map((symbol) => symbol.name)).toEqual([
        "makeThing",
        "Thing",
        "ThingConfig",
        "ThingInput",
        "thingId",
        "ThingKind",
      ]);
    });

    it("marks direct exported declaration symbols", () => {
      const result = parseFileStructure({
        source: "export const thingId = 'thing';",
      });
      expect(result.declarationSymbols[0]).toMatchObject({
        name: "thingId",
        kind: "const",
        isExported: true,
        isDefaultExport: false,
      });
    });

    it("marks default exported declaration symbols", () => {
      const result = parseFileStructure({
        source: "export default function makeThing() {}",
      });
      expect(result.declarationSymbols[0]).toMatchObject({
        name: "makeThing",
        kind: "function",
        isExported: true,
        isDefaultExport: true,
      });
    });

    it("does not extract let or var declaration symbols", () => {
      const result = parseFileStructure({
        source: "let x = 1;\nvar y = 2;",
      });
      expect(result.declarationSymbols).toEqual([]);
    });
  });

  describe("named export symbols", () => {
    it("extracts exported names and source names from named exports", () => {
      const result = parseFileStructure({
        source:
          "export { sourceName as exportedName, type TypeName } from './module';",
      });
      expect(result.namedExportSymbols).toEqual([
        {
          name: "exportedName",
          sourceName: "sourceName",
          isType: false,
          from: "./module",
          pos: { line: 1, column: 24 },
        },
        {
          name: "TypeName",
          sourceName: "TypeName",
          isType: true,
          from: "./module",
          pos: { line: 1, column: 43 },
        },
      ]);
    });

    it("extracts default export references", () => {
      const result = parseFileStructure({
        source: "const value = 1;\nexport default value;",
      });
      expect(result.defaultExportSymbols).toEqual([
        {
          name: "value",
          pos: { line: 2, column: 16 },
        },
      ]);
    });
  });

  describe("interfaces", () => {
    it("extracts interface declarations", () => {
      const result = parseFileStructure({
        source: "interface Foo { bar: string; }",
      });
      expect(result.interfaces).toHaveLength(1);
      expect(result.interfaces[0]).toMatchObject({
        name: "Foo",
        extends: [],
      });
    });

    it("extracts interface with extends", () => {
      const result = parseFileStructure({
        source: "interface Foo extends Bar, Baz { qux: number; }",
      });
      expect(result.interfaces).toHaveLength(1);
      expect(result.interfaces[0]).toMatchObject({
        name: "Foo",
        extends: [
          { name: "Bar", typeArguments: [] },
          { name: "Baz", typeArguments: [] },
        ],
      });
    });

    it("extracts interface extending Pick with type arguments", () => {
      const result = parseFileStructure({
        source: "interface Foo extends Pick<Bar, 'a' | 'b'> {}",
      });
      expect(result.interfaces).toHaveLength(1);
      expect(result.interfaces[0]).toMatchObject({
        name: "Foo",
        extends: [{ name: "Pick", typeArguments: ["Bar", "'a' | 'b'"] }],
      });
    });

    it("extracts interface extending Omit with type arguments", () => {
      const result = parseFileStructure({
        source: "interface Foo extends Omit<Bar, 'x'> {}",
      });
      expect(result.interfaces[0]).toMatchObject({
        name: "Foo",
        extends: [{ name: "Omit", typeArguments: ["Bar", "'x'"] }],
      });
    });

    it("extracts interface extending Partial", () => {
      const result = parseFileStructure({
        source: "interface Foo extends Partial<Bar> {}",
      });
      expect(result.interfaces[0]).toMatchObject({
        name: "Foo",
        extends: [{ name: "Partial", typeArguments: ["Bar"] }],
      });
    });

    it("extracts mixed extends with and without type arguments", () => {
      const result = parseFileStructure({
        source: "interface Foo extends Pick<Bar, 'a'>, Baz {}",
      });
      expect(result.interfaces[0]).toMatchObject({
        name: "Foo",
        extends: [
          { name: "Pick", typeArguments: ["Bar", "'a'"] },
          { name: "Baz", typeArguments: [] },
        ],
      });
    });
  });

  describe("classes", () => {
    it("extracts class declarations", () => {
      const result = parseFileStructure({
        source: "class MyClass {}",
      });
      expect(result.classes).toHaveLength(1);
      expect(result.classes[0]).toMatchObject({
        name: "MyClass",
      });
      expect(result.classes[0].extends).toBeUndefined();
    });

    it("extracts class with extends", () => {
      const result = parseFileStructure({
        source: "class Child extends Parent {}",
      });
      expect(result.classes).toHaveLength(1);
      expect(result.classes[0]).toMatchObject({
        name: "Child",
        extends: "Parent",
      });
    });

    it("extracts empty implements for class without implements", () => {
      const result = parseFileStructure({
        source: "class MyClass {}",
      });
      expect(result.classes[0].implements).toEqual([]);
    });

    it("extracts class with implements", () => {
      const result = parseFileStructure({
        source: "class MyClass implements Serializable {}",
      });
      expect(result.classes).toHaveLength(1);
      expect(result.classes[0]).toMatchObject({
        name: "MyClass",
        implements: ["Serializable"],
      });
    });

    it("extracts class with multiple implements", () => {
      const result = parseFileStructure({
        source: "class MyClass implements Serializable, Disposable {}",
      });
      expect(result.classes).toHaveLength(1);
      expect(result.classes[0]).toMatchObject({
        name: "MyClass",
        implements: ["Serializable", "Disposable"],
      });
    });

    it("extracts class with extends and implements", () => {
      const result = parseFileStructure({
        source: "class MyClass extends BaseClass implements Serializable {}",
      });
      expect(result.classes).toHaveLength(1);
      expect(result.classes[0]).toMatchObject({
        name: "MyClass",
        extends: "BaseClass",
        implements: ["Serializable"],
      });
    });
  });

  describe("functions", () => {
    it("extracts function declarations", () => {
      const result = parseFileStructure({
        source: "function greet(name: string): void {}",
      });
      expect(result.functions).toHaveLength(1);
      expect(result.functions[0]).toMatchObject({
        name: "greet",
        returnType: { text: "void", baseName: "void" },
      });
      expect(result.functions[0].params).toEqual([
        { name: "name", typeName: { text: "string", baseName: "string" } },
      ]);
    });

    it("extracts function with multiple params", () => {
      const result = parseFileStructure({
        source: "function add(a: number, b: number): number { return a + b; }",
      });
      expect(result.functions[0].params).toEqual([
        { name: "a", typeName: { text: "number", baseName: "number" } },
        { name: "b", typeName: { text: "number", baseName: "number" } },
      ]);
    });

    it("extracts function without return type", () => {
      const result = parseFileStructure({
        source: "function doSomething() {}",
      });
      expect(result.functions[0].returnType).toBeUndefined();
    });

    it("extracts function with untyped params", () => {
      const result = parseFileStructure({
        source: "function foo(x) {}",
      });
      expect(result.functions[0].params).toEqual([
        { name: "x", typeName: undefined },
      ]);
    });
  });

  describe("constants", () => {
    it("extracts const declarations with type annotation", () => {
      const result = parseFileStructure({
        source: "const value: number = 42;",
      });
      expect(result.constants).toHaveLength(1);
      expect(result.constants[0]).toMatchObject({
        name: "value",
        typeName: { text: "number", baseName: "number" },
      });
    });

    it("extracts const declarations without type annotation", () => {
      const result = parseFileStructure({
        source: "const greeting = 'hello';",
      });
      expect(result.constants).toHaveLength(1);
      expect(result.constants[0]).toMatchObject({
        name: "greeting",
        typeName: undefined,
      });
    });

    it("does not extract let or var declarations", () => {
      const result = parseFileStructure({
        source: "let x = 1;\nvar y = 2;",
      });
      expect(result.constants).toHaveLength(0);
    });
  });

  describe("type aliases", () => {
    it("extracts type alias declarations", () => {
      const result = parseFileStructure({
        source: "type ID = string | number;",
      });
      expect(result.typeAliases).toHaveLength(1);
      expect(result.typeAliases[0]).toMatchObject({ name: "ID" });
    });
  });

  describe("positions", () => {
    it("reports correct position for first line", () => {
      const result = parseFileStructure({
        source: "const x = 1;",
      });
      expect(result.constants[0].pos).toEqual({ line: 1, column: 1 });
    });

    it("reports correct position for later lines", () => {
      const source = ["const a = 1;", "", "function foo() {}"].join("\n");
      const result = parseFileStructure({ source });
      expect(result.functions[0].pos).toEqual({ line: 3, column: 1 });
    });

    it("reports correct column for indented code", () => {
      const source = "    const x = 1;";
      const result = parseFileStructure({ source });
      expect(result.constants[0].pos).toEqual({ line: 1, column: 5 });
    });

    it("reports correct positions for imports", () => {
      const source = [
        "import { foo } from 'bar';",
        "import { baz } from 'qux';",
      ].join("\n");
      const result = parseFileStructure({ source });
      expect(result.imports[0].pos).toEqual({ line: 1, column: 1 });
      expect(result.imports[1].pos).toEqual({ line: 2, column: 1 });
    });

    it("reports correct positions for exports", () => {
      const source = ["export function foo() {}", "export class Bar {}"].join(
        "\n"
      );
      const result = parseFileStructure({ source });
      expect(result.exports[0].pos).toEqual({ line: 1, column: 1 });
      expect(result.exports[1].pos).toEqual({ line: 2, column: 1 });
    });

    it("reports correct positions for interfaces", () => {
      const source = ["", "interface Foo { x: number; }"].join("\n");
      const result = parseFileStructure({ source });
      expect(result.interfaces[0].pos).toEqual({ line: 2, column: 1 });
    });

    it("reports correct positions for classes", () => {
      const source = ["", "  class Foo {}"].join("\n");
      const result = parseFileStructure({ source });
      expect(result.classes[0].pos).toEqual({ line: 2, column: 3 });
    });

    it("reports correct positions for type aliases", () => {
      const source = ["const x = 1;", "type ID = string;"].join("\n");
      const result = parseFileStructure({ source });
      expect(result.typeAliases[0].pos).toEqual({ line: 2, column: 1 });
    });
  });

  describe("combined source", () => {
    it("extracts all structure types from a complex file", () => {
      const source = [
        "import { something } from 'lib';",
        "import type { SomeType } from 'types';",
        "",
        "export interface Config extends BaseConfig {",
        "  debug: boolean;",
        "}",
        "",
        "export class Service extends BaseService {",
        "  run() {}",
        "}",
        "",
        "export function createService(opts: Config): Service {",
        "  return new Service();",
        "}",
        "",
        'export const VERSION: string = "1.0";',
        "",
        "export type Handler = (req: Request) => Response;",
        "",
        "export { helper } from './helper';",
      ].join("\n");

      const result = parseFileStructure({ source });

      expect(result.imports).toHaveLength(2);
      expect(result.imports[0].isType).toBe(false);
      expect(result.imports[1].isType).toBe(true);

      expect(result.interfaces).toHaveLength(1);
      expect(result.interfaces[0].extends).toEqual([
        { name: "BaseConfig", typeArguments: [] },
      ]);

      expect(result.classes).toHaveLength(1);
      expect(result.classes[0].extends).toBe("BaseService");

      expect(result.functions).toHaveLength(1);
      expect(result.functions[0].params).toEqual([
        { name: "opts", typeName: { text: "Config", baseName: "Config" } },
      ]);
      expect(result.functions[0].returnType).toEqual({
        text: "Service",
        baseName: "Service",
      });

      expect(result.constants).toHaveLength(1);
      expect(result.constants[0].typeName).toEqual({
        text: "string",
        baseName: "string",
      });

      expect(result.typeAliases).toHaveLength(1);
      expect(result.typeAliases[0].name).toBe("Handler");

      expect(result.exports.length).toBeGreaterThanOrEqual(6);
    });
  });

  describe("nonBarrelStatements", () => {
    it("is empty for a barrel using export-from in all forms", () => {
      const result = parseFileStructure({
        source: [
          "export * from './a';",
          "export * as ns from './b';",
          "export { a, b as c } from './c';",
          "export { default } from './d';",
          "export { default as Foo } from './e';",
          "import './polyfill';",
        ].join("\n"),
      });
      expect(result.nonBarrelStatements).toEqual([]);
    });

    it("is empty when named export references an imported identifier", () => {
      const result = parseFileStructure({
        source: "import { x } from './x';\nexport { x };",
      });
      expect(result.nonBarrelStatements).toEqual([]);
    });

    it("is empty when named export aliases an imported identifier", () => {
      const result = parseFileStructure({
        source: "import { x } from './x';\nexport { x as y };",
      });
      expect(result.nonBarrelStatements).toEqual([]);
    });

    it("is empty when default export forwards an imported identifier", () => {
      const result = parseFileStructure({
        source: "import x from './x';\nexport default x;",
      });
      expect(result.nonBarrelStatements).toEqual([]);
    });

    it("flags default export of a non-identifier expression", () => {
      const result = parseFileStructure({
        source: "export default { a: 1 };",
      });
      expect(result.nonBarrelStatements).toHaveLength(1);
      expect(result.nonBarrelStatements[0].kind).toBe("default-expression");
    });

    it("flags default export of a literal", () => {
      const result = parseFileStructure({ source: "export default 42;" });
      expect(result.nonBarrelStatements).toHaveLength(1);
      expect(result.nonBarrelStatements[0].kind).toBe("default-expression");
    });

    it("flags named export of a locally declared identifier", () => {
      const result = parseFileStructure({
        source: "const x = 1;\nexport { x };",
      });
      const kinds = result.nonBarrelStatements.map((n) => n.kind);
      expect(kinds).toContain("declaration");
      expect(kinds).toContain("named-export-local");
    });

    it("flags local const declarations", () => {
      const result = parseFileStructure({ source: "const x = 1;" });
      expect(result.nonBarrelStatements).toHaveLength(1);
      expect(result.nonBarrelStatements[0].kind).toBe("declaration");
    });

    it("flags exported const declarations", () => {
      const result = parseFileStructure({ source: "export const x = 1;" });
      expect(result.nonBarrelStatements).toHaveLength(1);
      expect(result.nonBarrelStatements[0].kind).toBe("declaration");
    });

    it("flags enum declarations", () => {
      const result = parseFileStructure({ source: "enum E { A }" });
      expect(result.nonBarrelStatements).toHaveLength(1);
      expect(result.nonBarrelStatements[0].kind).toBe("declaration");
    });

    it("flags exported enum declarations", () => {
      const result = parseFileStructure({ source: "export enum E { A }" });
      expect(result.nonBarrelStatements).toHaveLength(1);
      expect(result.nonBarrelStatements[0].kind).toBe("declaration");
    });

    it("flags top-level expression statements", () => {
      const result = parseFileStructure({ source: "doSomething();" });
      expect(result.nonBarrelStatements).toHaveLength(1);
      expect(result.nonBarrelStatements[0].kind).toBe("expression");
    });

    it("flags export equals", () => {
      const result = parseFileStructure({ source: "export = x;" });
      expect(result.nonBarrelStatements).toHaveLength(1);
      expect(result.nonBarrelStatements[0].kind).toBe("export-equals");
    });
  });
});
