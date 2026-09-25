import { describe, expect, it } from "vitest";
import type { PredicateContext } from "../../core/context.js";
import { parseFileStructure } from "../parser.js";
import { checkModuleSource, checkModuleSourceGroup } from "./module-source.js";

const context: PredicateContext = {
  path: "src/index.ts",
  placeholders: {},
  resolveTemplate: (value) => value.replace("${package}", "pkg"),
  fileExists: () => false,
  readDir: () => [],
};

function structure(source: string) {
  return parseFileStructure({ source, filePath: context.path });
}

function exact(opts: {
  source: string;
  expected: string | string[];
  kind: "type" | "value";
}) {
  return checkModuleSource({
    expected: opts.expected,
    direction: "export",
    kind: opts.kind,
    predicateName:
      opts.kind === "type" ? "exportTypesFrom" : "exportValuesFrom",
    context,
    fileStructure: structure(opts.source),
  });
}

describe("export source predicates", () => {
  it("matches named and bare star exports by kind, including per-specifier type exports", () => {
    const source = `export { value, type Options } from "pkg";
export * from "./values";
export type * from "./types";`;
    expect(
      exact({ source, expected: ["pkg", "./values"], kind: "value" })
    ).toEqual([]);
    expect(
      exact({ source, expected: ["pkg", "./types"], kind: "type" })
    ).toEqual([]);
    expect(
      exact({ source: 'export * from "pkg";', expected: "pkg", kind: "type" })
    ).toHaveLength(1);
    expect(
      exact({
        source: 'export type * from "pkg";',
        expected: "pkg",
        kind: "value",
      })
    ).toHaveLength(1);
  });

  it("ignores imports, local exports, namespace exports, and package roots for wildcard selectors", () => {
    const source = `import { value } from "pkg/sub";
export { value };
export * as ns from "pkg/sub";
export * from "pkg";`;
    expect(
      exact({ source, expected: "pkg/*", kind: "value" })[0]?.message
    ).toBe('Missing export from "pkg/*"');
    expect(exact({ source, expected: "pkg", kind: "value" })).toEqual([]);
  });

  it("resolves placeholders and handles exclusions and nested re-inclusions", () => {
    const expected = [
      "${package}/*",
      "!pkg/internal/*",
      "pkg/internal/public/*",
    ];
    expect(
      exact({
        source: 'export * from "pkg/internal/public/api";',
        expected,
        kind: "value",
      })
    ).toEqual([]);
    expect(
      exact({
        source: 'export * from "pkg/internal/private";',
        expected,
        kind: "value",
      })
    ).toHaveLength(1);
  });

  it("matches only the configured kind and directory group", () => {
    const fileStructure = structure(`export * from "./value";
export type { Type } from "../types";
export * as ns from "external";`);
    for (const [kind, group, expected] of [
      ["value", "currentDir", true],
      ["type", "parents", true],
      ["value", "externals", false],
      ["type", "currentDir", false],
    ] as const) {
      expect(
        checkModuleSourceGroup({
          expected,
          direction: "export",
          kind,
          group,
          predicateName: "test",
          context,
          fileStructure,
        })
      ).toEqual([]);
    }
    expect(
      checkModuleSourceGroup({
        expected: false,
        direction: "export",
        kind: "value",
        group: "currentDir",
        predicateName: "test",
        context,
        fileStructure,
      })[0]?.message
    ).toBe("Export from current directory is not allowed");
  });
});
