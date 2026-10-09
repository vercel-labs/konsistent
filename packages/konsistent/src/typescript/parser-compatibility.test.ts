import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { globSync } from "tinyglobby";
import { describe, expect, it } from "vitest";
import type { PredicateContext } from "../core/context.js";
import { matchTypeExpression } from "./constant-type-schema.js";
import { parseFileStructure } from "./parser.js";
import { checkCallFunction } from "./predicates/call-function.js";

const fixturesDirectory = resolve(
  import.meta.dirname,
  "../../../../e2e/fixtures"
);
const fixturePaths = globSync({
  cwd: fixturesDirectory,
  patterns: "**/*.{ts,tsx,js,jsx,mts,cts,mjs,cjs}",
  ignore: ["**/node_modules/**", "**/dist/**", "typescript-runtime*/**"],
}).sort();

const sourceCases = [
  "/* café 😀 漢 */ export const value = 1;",
  'const text = "😀é漢"; export function greet(): string { return text; }',
  "\r\n/* 😀 */ export interface A { x?: string }\r\nexport type B = A;",
  '\ufeff/* e\u0301 😀 */ export const café: string = "é";',
  'const text = "\ud800"; export const value = 1;',
  'const text = "\udfff"; export const value = 1;',
  'import type {Foo} from "./foo"; import {type Bar, value as local} from "./bar"; export {local};',
  'type T = { "😀"?: Foo; enabled?: boolean }; export default class X extends Base<Foo> implements T {}',
  "send((<Callback>callback)); send((callback as Callback)); send(callback!); send(callback satisfies Callback);",
  "const first = 1;\u2028export const second: number = 2;\u2029send(second);",
  "export const broken: = ; send(unterminated",
];

const typePairs = [
  ["Readonly< /* comment */ Foo >", "Readonly<Foo>"],
  [
    "Prettify<\n /* comment */ Options<Settings> & { sandbox?: never; }\n>",
    "Prettify<Options<Settings> & {sandbox?: never;}>",
  ],
  ['"a b"', '"ab"'],
  ["ModuleSettings", "{ enabled: boolean }"],
  ["A | (B & C)", "A | B & C"],
  ["(A)", "A"],
  ["((A))", "(A)"],
  ["(A /* c */)", "( A )"],
  ["[A, B]", "[ A , /* c */ B ]"],
  ["{ a: string, b?: number }", "{a: string; b?: number;}"],
  ["{ a: string }", "{a: string;}"],
  ["'email'", '"email"'],
  ['"\\u0061"', '"a"'],
  ["1e2", "100"],
  ['"é😀"', '"\\u00e9\\ud83d\\ude00"'],
  ["`a b`", "`ab`"],
  ["`prefix-${A | B}`", "`prefix-${ A|B }`"],
  ["{ readonly a?: Foo }", "{a?: Foo}"],
  ["{[K in keyof T]?: T[K]}", "{ [ K in keyof T ] ? : T [ K ] }"],
  ["T extends U ? A : B", "T extends U? A:B"],
  ["(x: A) => B", "( x : A ) => B"],
  ["A & (B | C)", "(A & B) | C"],
  ["A | B", "B | A"],
  ["Foo<", "Foo<"],
  ["Foo<", "Foo< "],
  ["A; type B = C", "A"],
  ["[x?: A, ...rest: B[]]", "[x? : A,...rest: B []]"],
  ['{ "a b": string }', '{ "ab": string }'],
  ["unique symbol", "unique /*c*/ symbol"],
  ['typeof import("module").name', 'typeof import( "module" ).name'],
  ["(A | B)[]", "A | B[]"],
  ['"\\ud800"', '"\ud800"'],
  ['"\ud800"', ' "\ud800" '],
  ["1_000", "1000"],
  ["0x10", "16"],
  ["0X10", "0x10"],
  ["0x1_0", "16"],
  ["0b10", "2"],
  ["0b1_0", "2"],
  ["0o10", "8"],
  ["100n", "1_00n"],
  ["0x1_0n", "0x10n"],
  ["0X10n", "0x10n"],
  ["\\u0041", "A"],
  ["Namespace.\\u0041", "Namespace.A"],
  ["{foo:string}", '{"foo":string}'],
  ['{"a":string}', '{"\\u0061":string}'],
  ["[A,B,]", "[A,B]"],
  ["Foo<A,>", "Foo<A>"],
  ["{a:string;;}", "{a:string}"],
  ["[a:A]", "[A]"],
  ["[...A[]]", "A[]"],
];

const expressionPairs = [
  ['"email"', "'email'"],
  ['("email")', "'email'"],
  ['"a b"', '"ab"'],
  ["options", "expectedOptions"],
  ["{ a: 1, b: true }", "{a:1,b:true}"],
  ["[1, 2]", "[1,/* c */2]"],
  ["foo.bar", 'foo["bar"]'],
  ["1 + 2", "1 - 2"],
  ["`😀${name}`", "`😀${name}`"],
  ["`a b`", "`ab`"],
  ["callback as Fn", "callback"],
  ["callback!", "callback"],
  ["(x) => x + 1", "(x)=>x+1"],
  ['"\\u0061"', '"a"'],
  ['"\\ud800"', '"\ud800"'],
  ['"\\udfff"', '"\udfff"'],
  ["1_000", "1000"],
  ["100n", "1_00n"],
  ["\\u0041", "A"],
  ["options", "options); injected("],
];

const context: PredicateContext = {
  path: "source.ts",
  placeholders: {},
  resolveTemplate: (text) => text,
  directoryExists: () => false,
  fileExists: () => false,
  readDir: () => [],
};

describe("TypeScript 5.9 compatibility contract", () => {
  it("preserves the structure of the existing CLI fixture corpus", () => {
    expect(fixturePaths.length).toBeGreaterThanOrEqual(271);
    const structures: Record<
      string,
      ReturnType<typeof parseFileStructure>
    > = Object.create(null);
    for (const filePath of fixturePaths) {
      structures[filePath] = parseFileStructure({
        source: readFileSync(resolve(fixturesDirectory, filePath), "utf8"),
        filePath,
      });
    }
    expect(JSON.stringify(structures, null, 2)).toMatchSnapshot();
  });

  it("preserves source text, Unicode positions, and syntax recovery", () => {
    expect(
      JSON.stringify(
        sourceCases.map((source) => parseFileStructure({ source })),
        null,
        2
      )
    ).toMatchSnapshot();
    expect(
      JSON.stringify(
        parseFileStructure({
          source: 'export const View = () => <div title="😀"/>;',
          filePath: "view.tsx",
        }),
        null,
        2
      )
    ).toMatchSnapshot();
  });

  it("preserves exact type-expression matching", () => {
    expect(
      JSON.stringify(
        typePairs.map(([actual, expected]) => ({
          actual,
          expected,
          result: matchTypeExpression({
            actual,
            expected,
            missingReason: "missing",
          }),
        })),
        null,
        2
      )
    ).toMatchSnapshot();
  });

  it("preserves configured call-argument matching", () => {
    expect(
      JSON.stringify(
        expressionPairs.map(([actual, expected]) => ({
          actual,
          expected,
          diagnostics: checkCallFunction({
            context,
            expected: [{ name: "send", arguments: [expected] }],
            fileStructure: parseFileStructure({ source: `send(${actual});` }),
          }),
        })),
        null,
        2
      )
    ).toMatchSnapshot();
  });
});
