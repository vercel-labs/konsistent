import { describe, expect, it } from 'vitest';
import { parseFileStructure } from './parser.js';

describe('parseFileStructure', () => {
  describe('exports', () => {
    it('extracts exported function declarations', () => {
      const result = parseFileStructure({
        source: 'export function greet(name: string): string { return name; }',
      });
      expect(result.exports).toHaveLength(1);
      expect(result.exports[0]).toMatchObject({
        name: 'greet',
        kind: 'function',
        isType: false,
      });
    });

    it('extracts exported class declarations', () => {
      const result = parseFileStructure({
        source: 'export class MyClass {}',
      });
      expect(result.exports).toHaveLength(1);
      expect(result.exports[0]).toMatchObject({
        name: 'MyClass',
        kind: 'class',
        isType: false,
      });
    });

    it('extracts exported interface declarations', () => {
      const result = parseFileStructure({
        source: 'export interface MyInterface { foo: string; }',
      });
      expect(result.exports).toHaveLength(1);
      expect(result.exports[0]).toMatchObject({
        name: 'MyInterface',
        kind: 'interface',
        isType: true,
      });
    });

    it('extracts exported const declarations', () => {
      const result = parseFileStructure({
        source: 'export const value: number = 42;',
      });
      expect(result.exports).toHaveLength(1);
      expect(result.exports[0]).toMatchObject({
        name: 'value',
        kind: 'const',
        isType: false,
      });
    });

    it('extracts exported enum declarations', () => {
      const result = parseFileStructure({
        source: 'export enum Direction { Up, Down, Left, Right }',
      });
      expect(result.exports).toHaveLength(1);
      expect(result.exports[0]).toMatchObject({
        name: 'Direction',
        kind: 'enum',
        isType: false,
      });
    });

    it('extracts named re-exports without from', () => {
      const source = [
        'const foo = 1;',
        'const bar = 2;',
        'export { foo, bar };',
      ].join('\n');
      const result = parseFileStructure({ source });
      expect(result.exports).toHaveLength(2);
      expect(result.exports[0]).toMatchObject({
        name: 'foo',
        kind: 're-export',
        isType: false,
      });
      expect(result.exports[0].from).toBeUndefined();
      expect(result.exports[1]).toMatchObject({
        name: 'bar',
        kind: 're-export',
        isType: false,
      });
    });

    it('extracts re-exports with from', () => {
      const result = parseFileStructure({
        source: "export { foo, bar } from './module';",
      });
      expect(result.exports).toHaveLength(2);
      expect(result.exports[0]).toMatchObject({
        name: 'foo',
        kind: 're-export',
        from: './module',
        isType: false,
      });
    });

    it('extracts type exports', () => {
      const result = parseFileStructure({
        source: "export type { Foo } from './types';",
      });
      expect(result.exports).toHaveLength(1);
      expect(result.exports[0]).toMatchObject({
        name: 'Foo',
        kind: 're-export',
        from: './types',
        isType: true,
      });
    });

    it('extracts individual type exports in named export', () => {
      const result = parseFileStructure({
        source: "export { type Foo, bar } from './module';",
      });
      expect(result.exports).toHaveLength(2);
      expect(result.exports[0]).toMatchObject({
        name: 'Foo',
        isType: true,
      });
      expect(result.exports[1]).toMatchObject({
        name: 'bar',
        isType: false,
      });
    });

    it('extracts star re-exports', () => {
      const result = parseFileStructure({
        source: "export * from './everything';",
      });
      expect(result.exports).toHaveLength(1);
      expect(result.exports[0]).toMatchObject({
        name: '*',
        kind: 're-export',
        from: './everything',
      });
    });

    it('extracts default export', () => {
      const result = parseFileStructure({
        source: 'export default function() {}',
      });
      expect(result.exports).toHaveLength(1);
      expect(result.exports[0]).toMatchObject({
        name: 'default',
        isType: false,
      });
    });

    it('extracts exported type alias declarations', () => {
      const result = parseFileStructure({
        source: 'export type MyType = string | number;',
      });
      expect(result.exports).toHaveLength(1);
      expect(result.exports[0]).toMatchObject({
        name: 'MyType',
        kind: 'interface',
        isType: true,
      });
    });
  });

  describe('imports', () => {
    it('extracts named imports', () => {
      const result = parseFileStructure({
        source: "import { foo, bar } from 'module';",
      });
      expect(result.imports).toHaveLength(2);
      expect(result.imports[0]).toMatchObject({
        name: 'foo',
        from: 'module',
        isType: false,
      });
      expect(result.imports[1]).toMatchObject({
        name: 'bar',
        from: 'module',
        isType: false,
      });
    });

    it('extracts type imports', () => {
      const result = parseFileStructure({
        source: "import type { Foo } from 'module';",
      });
      expect(result.imports).toHaveLength(1);
      expect(result.imports[0]).toMatchObject({
        name: 'Foo',
        from: 'module',
        isType: true,
      });
    });

    it('extracts individual type imports', () => {
      const result = parseFileStructure({
        source: "import { type Foo, bar } from 'module';",
      });
      expect(result.imports).toHaveLength(2);
      expect(result.imports[0]).toMatchObject({
        name: 'Foo',
        isType: true,
      });
      expect(result.imports[1]).toMatchObject({
        name: 'bar',
        isType: false,
      });
    });

    it('extracts namespace imports', () => {
      const result = parseFileStructure({
        source: "import * as ns from 'module';",
      });
      expect(result.imports).toHaveLength(1);
      expect(result.imports[0]).toMatchObject({
        name: 'ns',
        from: 'module',
        isType: false,
      });
    });

    it('extracts default imports', () => {
      const result = parseFileStructure({
        source: "import DefaultExport from 'module';",
      });
      expect(result.imports).toHaveLength(1);
      expect(result.imports[0]).toMatchObject({
        name: 'DefaultExport',
        from: 'module',
        isType: false,
      });
    });
  });

  describe('interfaces', () => {
    it('extracts interface declarations', () => {
      const result = parseFileStructure({
        source: 'interface Foo { bar: string; }',
      });
      expect(result.interfaces).toHaveLength(1);
      expect(result.interfaces[0]).toMatchObject({
        name: 'Foo',
        extends: [],
      });
    });

    it('extracts interface with extends', () => {
      const result = parseFileStructure({
        source: 'interface Foo extends Bar, Baz { qux: number; }',
      });
      expect(result.interfaces).toHaveLength(1);
      expect(result.interfaces[0]).toMatchObject({
        name: 'Foo',
        extends: ['Bar', 'Baz'],
      });
    });
  });

  describe('classes', () => {
    it('extracts class declarations', () => {
      const result = parseFileStructure({
        source: 'class MyClass {}',
      });
      expect(result.classes).toHaveLength(1);
      expect(result.classes[0]).toMatchObject({
        name: 'MyClass',
      });
      expect(result.classes[0].extends).toBeUndefined();
    });

    it('extracts class with extends', () => {
      const result = parseFileStructure({
        source: 'class Child extends Parent {}',
      });
      expect(result.classes).toHaveLength(1);
      expect(result.classes[0]).toMatchObject({
        name: 'Child',
        extends: 'Parent',
      });
    });
  });

  describe('functions', () => {
    it('extracts function declarations', () => {
      const result = parseFileStructure({
        source: 'function greet(name: string): void {}',
      });
      expect(result.functions).toHaveLength(1);
      expect(result.functions[0]).toMatchObject({
        name: 'greet',
        returnType: 'void',
      });
      expect(result.functions[0].params).toEqual([
        { name: 'name', typeName: 'string' },
      ]);
    });

    it('extracts function with multiple params', () => {
      const result = parseFileStructure({
        source: 'function add(a: number, b: number): number { return a + b; }',
      });
      expect(result.functions[0].params).toEqual([
        { name: 'a', typeName: 'number' },
        { name: 'b', typeName: 'number' },
      ]);
    });

    it('extracts function without return type', () => {
      const result = parseFileStructure({
        source: 'function doSomething() {}',
      });
      expect(result.functions[0].returnType).toBeUndefined();
    });

    it('extracts function with untyped params', () => {
      const result = parseFileStructure({
        source: 'function foo(x) {}',
      });
      expect(result.functions[0].params).toEqual([
        { name: 'x', typeName: undefined },
      ]);
    });
  });

  describe('constants', () => {
    it('extracts const declarations with type annotation', () => {
      const result = parseFileStructure({
        source: 'const value: number = 42;',
      });
      expect(result.constants).toHaveLength(1);
      expect(result.constants[0]).toMatchObject({
        name: 'value',
        typeName: 'number',
      });
    });

    it('extracts const declarations without type annotation', () => {
      const result = parseFileStructure({
        source: "const greeting = 'hello';",
      });
      expect(result.constants).toHaveLength(1);
      expect(result.constants[0]).toMatchObject({
        name: 'greeting',
        typeName: undefined,
      });
    });

    it('does not extract let or var declarations', () => {
      const result = parseFileStructure({
        source: 'let x = 1;\nvar y = 2;',
      });
      expect(result.constants).toHaveLength(0);
    });
  });

  describe('type aliases', () => {
    it('extracts type alias declarations', () => {
      const result = parseFileStructure({
        source: 'type ID = string | number;',
      });
      expect(result.typeAliases).toHaveLength(1);
      expect(result.typeAliases[0]).toMatchObject({ name: 'ID' });
    });
  });

  describe('positions', () => {
    it('reports correct position for first line', () => {
      const result = parseFileStructure({
        source: 'const x = 1;',
      });
      expect(result.constants[0].pos).toEqual({ line: 1, column: 1 });
    });

    it('reports correct position for later lines', () => {
      const source = ['const a = 1;', '', 'function foo() {}'].join('\n');
      const result = parseFileStructure({ source });
      expect(result.functions[0].pos).toEqual({ line: 3, column: 1 });
    });

    it('reports correct column for indented code', () => {
      const source = '    const x = 1;';
      const result = parseFileStructure({ source });
      expect(result.constants[0].pos).toEqual({ line: 1, column: 5 });
    });

    it('reports correct positions for imports', () => {
      const source = [
        "import { foo } from 'bar';",
        "import { baz } from 'qux';",
      ].join('\n');
      const result = parseFileStructure({ source });
      expect(result.imports[0].pos).toEqual({ line: 1, column: 1 });
      expect(result.imports[1].pos).toEqual({ line: 2, column: 1 });
    });

    it('reports correct positions for exports', () => {
      const source = ['export function foo() {}', 'export class Bar {}'].join(
        '\n'
      );
      const result = parseFileStructure({ source });
      expect(result.exports[0].pos).toEqual({ line: 1, column: 1 });
      expect(result.exports[1].pos).toEqual({ line: 2, column: 1 });
    });

    it('reports correct positions for interfaces', () => {
      const source = ['', 'interface Foo { x: number; }'].join('\n');
      const result = parseFileStructure({ source });
      expect(result.interfaces[0].pos).toEqual({ line: 2, column: 1 });
    });

    it('reports correct positions for classes', () => {
      const source = ['', '  class Foo {}'].join('\n');
      const result = parseFileStructure({ source });
      expect(result.classes[0].pos).toEqual({ line: 2, column: 3 });
    });

    it('reports correct positions for type aliases', () => {
      const source = ['const x = 1;', 'type ID = string;'].join('\n');
      const result = parseFileStructure({ source });
      expect(result.typeAliases[0].pos).toEqual({ line: 2, column: 1 });
    });
  });

  describe('combined source', () => {
    it('extracts all structure types from a complex file', () => {
      const source = [
        "import { something } from 'lib';",
        "import type { SomeType } from 'types';",
        '',
        'export interface Config extends BaseConfig {',
        '  debug: boolean;',
        '}',
        '',
        'export class Service extends BaseService {',
        '  run() {}',
        '}',
        '',
        'export function createService(opts: Config): Service {',
        '  return new Service();',
        '}',
        '',
        'export const VERSION: string = "1.0";',
        '',
        'export type Handler = (req: Request) => Response;',
        '',
        "export { helper } from './helper';",
      ].join('\n');

      const result = parseFileStructure({ source });

      expect(result.imports).toHaveLength(2);
      expect(result.imports[0].isType).toBe(false);
      expect(result.imports[1].isType).toBe(true);

      expect(result.interfaces).toHaveLength(1);
      expect(result.interfaces[0].extends).toEqual(['BaseConfig']);

      expect(result.classes).toHaveLength(1);
      expect(result.classes[0].extends).toBe('BaseService');

      expect(result.functions).toHaveLength(1);
      expect(result.functions[0].params).toEqual([
        { name: 'opts', typeName: 'Config' },
      ]);
      expect(result.functions[0].returnType).toBe('Service');

      expect(result.constants).toHaveLength(1);
      expect(result.constants[0].typeName).toBe('string');

      expect(result.typeAliases).toHaveLength(1);
      expect(result.typeAliases[0].name).toBe('Handler');

      expect(result.exports.length).toBeGreaterThanOrEqual(6);
    });
  });
});
