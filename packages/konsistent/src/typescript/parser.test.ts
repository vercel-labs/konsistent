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
        isType: false,
        kind: "function",
        name: "greet",
      });
    });

    it("extracts exported class declarations", () => {
      const result = parseFileStructure({
        source: "export class MyClass {}",
      });
      expect(result.exports).toHaveLength(1);
      expect(result.exports[0]).toMatchObject({
        isType: false,
        kind: "class",
        name: "MyClass",
      });
    });

    it("extracts exported interface declarations", () => {
      const result = parseFileStructure({
        source: "export interface MyInterface { foo: string; }",
      });
      expect(result.exports).toHaveLength(1);
      expect(result.exports[0]).toMatchObject({
        isType: true,
        kind: "interface",
        name: "MyInterface",
      });
    });

    it("extracts exported const declarations", () => {
      const result = parseFileStructure({
        source: "export const value: number = 42;",
      });
      expect(result.exports).toHaveLength(1);
      expect(result.exports[0]).toMatchObject({
        isType: false,
        kind: "const",
        name: "value",
      });
    });

    it("extracts exported enum declarations", () => {
      const result = parseFileStructure({
        source: "export enum Direction { Up, Down, Left, Right }",
      });
      expect(result.exports).toHaveLength(1);
      expect(result.exports[0]).toMatchObject({
        isType: false,
        kind: "enum",
        name: "Direction",
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
        isType: false,
        kind: "re-export",
        name: "foo",
      });
      expect(result.exports[0].from).toBeUndefined();
      expect(result.exports[1]).toMatchObject({
        isType: false,
        kind: "re-export",
        name: "bar",
      });
    });

    it("extracts re-exports with from", () => {
      const result = parseFileStructure({
        source: "export { foo, bar } from './module';",
      });
      expect(result.exports).toHaveLength(2);
      expect(result.exports[0]).toMatchObject({
        from: "./module",
        isType: false,
        kind: "re-export",
        name: "foo",
      });
    });

    it("extracts type exports", () => {
      const result = parseFileStructure({
        source: "export type { Foo } from './types';",
      });
      expect(result.exports).toHaveLength(1);
      expect(result.exports[0]).toMatchObject({
        from: "./types",
        isType: true,
        kind: "re-export",
        name: "Foo",
      });
    });

    it("extracts individual type exports in named export", () => {
      const result = parseFileStructure({
        source: "export { type Foo, bar } from './module';",
      });
      expect(result.exports).toHaveLength(2);
      expect(result.exports[0]).toMatchObject({
        isType: true,
        name: "Foo",
      });
      expect(result.exports[1]).toMatchObject({
        isType: false,
        name: "bar",
      });
    });

    it("extracts star re-exports", () => {
      const result = parseFileStructure({
        source: "export * from './everything';",
      });
      expect(result.exports).toHaveLength(1);
      expect(result.exports[0]).toMatchObject({
        from: "./everything",
        kind: "re-export",
        name: "*",
      });
    });

    it("extracts default export", () => {
      const result = parseFileStructure({
        source: "export default function() {}",
      });
      expect(result.exports).toHaveLength(1);
      expect(result.exports[0]).toMatchObject({
        isType: false,
        name: "default",
      });
    });

    it("extracts exported type alias declarations", () => {
      const result = parseFileStructure({
        source: "export type MyType = string | number;",
      });
      expect(result.exports).toHaveLength(1);
      expect(result.exports[0]).toMatchObject({
        isType: true,
        kind: "interface",
        name: "MyType",
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
        from: "module",
        isType: false,
        kind: "named",
        name: "foo",
        sourceName: "foo",
      });
      expect(result.imports[1]).toMatchObject({
        from: "module",
        isType: false,
        kind: "named",
        name: "bar",
        sourceName: "bar",
      });
    });

    it("extracts original and local names from aliased named imports", () => {
      const result = parseFileStructure({
        source:
          "import { sourceName as localName, type SourceType as LocalType } from 'module';",
      });
      expect(result.imports).toMatchObject([
        {
          isType: false,
          kind: "named",
          name: "localName",
          sourceName: "sourceName",
        },
        {
          isType: true,
          kind: "named",
          name: "LocalType",
          sourceName: "SourceType",
        },
      ]);
    });

    it("extracts type imports", () => {
      const result = parseFileStructure({
        source: "import type { Foo } from 'module';",
      });
      expect(result.imports).toHaveLength(1);
      expect(result.imports[0]).toMatchObject({
        from: "module",
        isType: true,
        name: "Foo",
      });
    });

    it("extracts individual type imports", () => {
      const result = parseFileStructure({
        source: "import { type Foo, bar } from 'module';",
      });
      expect(result.imports).toHaveLength(2);
      expect(result.imports[0]).toMatchObject({
        isType: true,
        name: "Foo",
      });
      expect(result.imports[1]).toMatchObject({
        isType: false,
        name: "bar",
      });
    });

    it("extracts namespace imports", () => {
      const result = parseFileStructure({
        source: "import * as ns from 'module';",
      });
      expect(result.imports).toHaveLength(1);
      expect(result.imports[0]).toMatchObject({
        from: "module",
        isType: false,
        kind: "namespace",
        name: "ns",
      });
    });

    it("extracts default imports", () => {
      const result = parseFileStructure({
        source: "import DefaultExport from 'module';",
      });
      expect(result.imports).toHaveLength(1);
      expect(result.imports[0]).toMatchObject({
        from: "module",
        isType: false,
        kind: "default",
        name: "DefaultExport",
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
          pos: { column: 1, line: 1 },
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
          pos: { column: 1, line: 1 },
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
          pos: { column: 1, line: 1 },
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
          pos: { column: 1, line: 1 },
        },
        {
          from: "./module",
          isType: true,
          pos: { column: 1, line: 1 },
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
        isDefaultExport: false,
        isExported: true,
        kind: "const",
        name: "thingId",
      });
    });

    it("marks default exported declaration symbols", () => {
      const result = parseFileStructure({
        source: "export default function makeThing() {}",
      });
      expect(result.declarationSymbols[0]).toMatchObject({
        isDefaultExport: true,
        isExported: true,
        kind: "function",
        name: "makeThing",
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
          from: "./module",
          isType: false,
          name: "exportedName",
          pos: { column: 24, line: 1 },
          sourceName: "sourceName",
        },
        {
          from: "./module",
          isType: true,
          name: "TypeName",
          pos: { column: 43, line: 1 },
          sourceName: "TypeName",
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
          pos: { column: 16, line: 2 },
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
        extends: [],
        name: "Foo",
        typeInfo: {
          kind: "object",
          properties: [{ name: "bar", optional: false, type: "string" }],
        },
      });
    });

    it("extracts interface with extends", () => {
      const result = parseFileStructure({
        source: "interface Foo extends Bar, Baz { qux: number; }",
      });
      expect(result.interfaces).toHaveLength(1);
      expect(result.interfaces[0]).toMatchObject({
        extends: [
          { name: "Bar", typeArguments: [] },
          { name: "Baz", typeArguments: [] },
        ],
        name: "Foo",
        typeInfo: { kind: "unsupported" },
      });
    });

    it("extracts interface extending Pick with type arguments", () => {
      const result = parseFileStructure({
        source: "interface Foo extends Pick<Bar, 'a' | 'b'> {}",
      });
      expect(result.interfaces).toHaveLength(1);
      expect(result.interfaces[0]).toMatchObject({
        extends: [{ name: "Pick", typeArguments: ["Bar", "'a' | 'b'"] }],
        name: "Foo",
      });
    });

    it("extracts interface extending Omit with type arguments", () => {
      const result = parseFileStructure({
        source: "interface Foo extends Omit<Bar, 'x'> {}",
      });
      expect(result.interfaces[0]).toMatchObject({
        extends: [{ name: "Omit", typeArguments: ["Bar", "'x'"] }],
        name: "Foo",
      });
    });

    it("extracts interface extending Partial", () => {
      const result = parseFileStructure({
        source: "interface Foo extends Partial<Bar> {}",
      });
      expect(result.interfaces[0]).toMatchObject({
        extends: [{ name: "Partial", typeArguments: ["Bar"] }],
        name: "Foo",
      });
    });

    it("extracts mixed extends with and without type arguments", () => {
      const result = parseFileStructure({
        source: "interface Foo extends Pick<Bar, 'a'>, Baz {}",
      });
      expect(result.interfaces[0]).toMatchObject({
        extends: [
          { name: "Pick", typeArguments: ["Bar", "'a'"] },
          { name: "Baz", typeArguments: [] },
        ],
        name: "Foo",
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
        extends: "Parent",
        name: "Child",
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
        implements: ["Serializable"],
        name: "MyClass",
      });
    });

    it("extracts class with multiple implements", () => {
      const result = parseFileStructure({
        source: "class MyClass implements Serializable, Disposable {}",
      });
      expect(result.classes).toHaveLength(1);
      expect(result.classes[0]).toMatchObject({
        implements: ["Serializable", "Disposable"],
        name: "MyClass",
      });
    });

    it("extracts class with extends and implements", () => {
      const result = parseFileStructure({
        source: "class MyClass extends BaseClass implements Serializable {}",
      });
      expect(result.classes).toHaveLength(1);
      expect(result.classes[0]).toMatchObject({
        extends: "BaseClass",
        implements: ["Serializable"],
        name: "MyClass",
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
        returnType: { baseName: "void", text: "void" },
      });
      expect(result.functions[0].params).toEqual([
        { name: "name", typeName: { baseName: "string", text: "string" } },
      ]);
    });

    it("extracts function with multiple params", () => {
      const result = parseFileStructure({
        source: "function add(a: number, b: number): number { return a + b; }",
      });
      expect(result.functions[0].params).toEqual([
        { name: "a", typeName: { baseName: "number", text: "number" } },
        { name: "b", typeName: { baseName: "number", text: "number" } },
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
        typeName: { baseName: "number", text: "number" },
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
      expect(result.typeAliases[0]).toMatchObject({
        name: "ID",
        typeInfo: { kind: "unsupported" },
        typeName: {
          baseName: "string | number",
          text: "string | number",
        },
      });
    });

    it("extracts type alias shapes", () => {
      const result = parseFileStructure({
        source: "type Settings = { model?: string; timeout: number };",
      });
      expect(result.typeAliases[0]).toMatchObject({
        name: "Settings",
        typeInfo: {
          kind: "object",
          properties: [
            { name: "model", optional: true, type: "string" },
            { name: "timeout", optional: false, type: "number" },
          ],
        },
      });
    });

    it("preserves complete type alias expressions", () => {
      const result = parseFileStructure({
        source: [
          "type Generic = Shared<'value'>;",
          "type Union = Left | Right;",
          "type Tuple = readonly [First, Second];",
          "type Multiline =",
          "  | First",
          "  | Second;",
        ].join("\n"),
      });

      expect(result.typeAliases.map((entry) => entry.typeName.text)).toEqual([
        "Shared<'value'>",
        "Left | Right",
        "readonly [First, Second]",
        ["| First", "  | Second"].join("\n"),
      ]);
    });
  });

  describe("positions", () => {
    it("reports correct position for first line", () => {
      const result = parseFileStructure({
        source: "const x = 1;",
      });
      expect(result.constants[0].pos).toEqual({ column: 1, line: 1 });
    });

    it("reports correct position for later lines", () => {
      const source = ["const a = 1;", "", "function foo() {}"].join("\n");
      const result = parseFileStructure({ source });
      expect(result.functions[0].pos).toEqual({ column: 1, line: 3 });
    });

    it("reports correct column for indented code", () => {
      const source = "    const x = 1;";
      const result = parseFileStructure({ source });
      expect(result.constants[0].pos).toEqual({ column: 5, line: 1 });
    });

    it("reports correct positions for imports", () => {
      const source = [
        "import { foo } from 'bar';",
        "import { baz } from 'qux';",
      ].join("\n");
      const result = parseFileStructure({ source });
      expect(result.imports[0].pos).toEqual({ column: 1, line: 1 });
      expect(result.imports[1].pos).toEqual({ column: 1, line: 2 });
    });

    it("reports correct positions for exports", () => {
      const source = ["export function foo() {}", "export class Bar {}"].join(
        "\n"
      );
      const result = parseFileStructure({ source });
      expect(result.exports[0].pos).toEqual({ column: 1, line: 1 });
      expect(result.exports[1].pos).toEqual({ column: 1, line: 2 });
    });

    it("reports correct positions for interfaces", () => {
      const source = ["", "interface Foo { x: number; }"].join("\n");
      const result = parseFileStructure({ source });
      expect(result.interfaces[0].pos).toEqual({ column: 1, line: 2 });
    });

    it("reports correct positions for classes", () => {
      const source = ["", "  class Foo {}"].join("\n");
      const result = parseFileStructure({ source });
      expect(result.classes[0].pos).toEqual({ column: 3, line: 2 });
    });

    it("reports correct positions for type aliases", () => {
      const source = ["const x = 1;", "type ID = string;"].join("\n");
      const result = parseFileStructure({ source });
      expect(result.typeAliases[0].pos).toEqual({ column: 1, line: 2 });
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
        { name: "opts", typeName: { baseName: "Config", text: "Config" } },
      ]);
      expect(result.functions[0].returnType).toEqual({
        baseName: "Service",
        text: "Service",
      });

      expect(result.constants).toHaveLength(1);
      expect(result.constants[0].typeName).toEqual({
        baseName: "string",
        text: "string",
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

  describe("calls", () => {
    it("extracts direct, imported, nested, and member calls", () => {
      const result = parseFileStructure({
        source: [
          'import { send as dispatch } from "./api";',
          "function run() {",
          '  initialize("x", options);',
          "  dispatch('email');",
          "  client.send?.(getValue());",
          "  outer(inner());",
          "}",
        ].join("\n"),
      });

      expect(result.calls.map((call) => call.name)).toEqual([
        "initialize",
        "dispatch",
        "send",
        "getValue",
        "outer",
        "inner",
      ]);
      expect(result.calls[0]?.arguments).toEqual(['"x"', "options"]);
      expect(result.calls[1]?.arguments).toEqual(["'email'"]);
    });

    it("ignores computed member calls and constructor calls", () => {
      const result = parseFileStructure({
        source: 'new Service(); client["send"]();',
      });

      expect(result.calls).toEqual([]);
    });

    it("reports the call position", () => {
      const result = parseFileStructure({
        source: ["", "  initialize();"].join("\n"),
      });

      expect(result.calls[0]?.pos).toEqual({ column: 3, line: 2 });
    });
  });
});
