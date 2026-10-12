import { describe, expect, it } from "vitest";
import type { PredicateContext } from "../../core/context.js";
import { parseFileStructure } from "../parser.js";
import { checkModuleSource, checkModuleSourceGroup } from "./module-source.js";

const context: PredicateContext = {
  directoryExists: () => false,
  fileExists: () => false,
  path: "src/index.ts",
  placeholders: {},
  readDir: () => [],
  resolveTemplate: (value) => value.replace("${package}", "pkg"),
};

function structure(source: string) {
  return parseFileStructure({ filePath: context.path, source });
}

function exact(opts: {
  source: string;
  expected: string | string[];
  kind: "type" | "value";
}) {
  return checkModuleSource({
    context,
    direction: "export",
    expected: opts.expected,
    fileStructure: structure(opts.source),
    kind: opts.kind,
    predicateName:
      opts.kind === "type" ? "exportTypesFrom" : "exportValuesFrom",
  });
}

describe("export source predicates", () => {
  it("matches named and bare star exports by kind, including per-specifier type exports", () => {
    const source = `export { value, type Options } from "pkg";
export * from "./values";
export type * from "./types";`;
    expect(
      exact({ expected: ["pkg", "./values"], kind: "value", source })
    ).toEqual([]);
    expect(
      exact({ expected: ["pkg", "./types"], kind: "type", source })
    ).toEqual([]);
    expect(
      exact({ expected: "pkg", kind: "type", source: 'export * from "pkg";' })
    ).toHaveLength(1);
    expect(
      exact({
        expected: "pkg",
        kind: "value",
        source: 'export type * from "pkg";',
      })
    ).toHaveLength(1);
  });

  it("ignores imports, local exports, namespace exports, and package roots for wildcard selectors", () => {
    const source = `import { value } from "pkg/sub";
export { value };
export * as ns from "pkg/sub";
export * from "pkg";`;
    expect(
      exact({ expected: "pkg/*", kind: "value", source })[0]?.message
    ).toBe('Missing export from "pkg/*"');
    expect(exact({ expected: "pkg", kind: "value", source })).toEqual([]);
  });

  it("resolves placeholders and handles exclusions and nested re-inclusions", () => {
    const expected = [
      "${package}/*",
      "!pkg/internal/*",
      "pkg/internal/public/*",
    ];
    expect(
      exact({
        expected,
        kind: "value",
        source: 'export * from "pkg/internal/public/api";',
      })
    ).toEqual([]);
    expect(
      exact({
        expected,
        kind: "value",
        source: 'export * from "pkg/internal/private";',
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
          context,
          direction: "export",
          expected,
          fileStructure,
          group,
          kind,
          predicateName: "test",
        })
      ).toEqual([]);
    }
    expect(
      checkModuleSourceGroup({
        context,
        direction: "export",
        expected: false,
        fileStructure,
        group: "currentDir",
        kind: "value",
        predicateName: "test",
      })[0]?.message
    ).toBe("Export from current directory is not allowed");
  });
});
