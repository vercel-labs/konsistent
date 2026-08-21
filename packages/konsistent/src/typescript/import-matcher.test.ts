import { describe, expect, it } from "vitest";
import type { PredicateContext } from "../core/context.js";
import { hasImport, hasImportFrom } from "./import-matcher.js";
import { parseFileStructure } from "./parser.js";

function createContext(opts: {
  placeholders?: Record<string, { toString(): string }>;
}): PredicateContext {
  const placeholders = opts.placeholders ?? {};
  return {
    path: "src/index.ts",
    placeholders: placeholders as PredicateContext["placeholders"],
    resolveTemplate(template: string): string {
      return template.replace(
        /\$\{(\w+)\}/g,
        (match, name) => placeholders[name]?.toString() ?? match
      );
    },
    fileExists: () => false,
    readDir: () => [],
  };
}

describe("import matcher", () => {
  const fileStructure = parseFileStructure({
    source: [
      'import { sourceValue as localValue, type SourceType as LocalType } from "pkg";',
      'import "./setup";',
    ].join("\n"),
  });
  const context = createContext({});

  it("matches value imports by their original name regardless of alias", () => {
    expect(
      hasImport({
        expected: { name: "sourceValue", from: "pkg" },
        importKind: "value",
        context,
        fileStructure,
      })
    ).toBe(true);
    expect(
      hasImport({
        expected: "localValue",
        importKind: "value",
        context,
        fileStructure,
      })
    ).toBe(false);
  });

  it("keeps value and type imports separate", () => {
    expect(
      hasImport({
        expected: "SourceType",
        importKind: "type",
        context,
        fileStructure,
      })
    ).toBe(true);
    expect(
      hasImport({
        expected: "SourceType",
        importKind: "value",
        context,
        fileStructure,
      })
    ).toBe(false);
  });

  it("resolves placeholders in names and sources", () => {
    const placeholderContext = createContext({
      placeholders: {
        symbol: { toString: () => "sourceValue" },
        source: { toString: () => "pkg" },
      },
    });
    expect(
      hasImport({
        expected: { name: "${symbol}", from: "${source}" },
        importKind: "value",
        context: placeholderContext,
        fileStructure,
      })
    ).toBe(true);
  });

  it("matches exact value and type import sources", () => {
    expect(
      hasImportFrom({
        expected: "pkg",
        importKind: "value",
        context,
        fileStructure,
      })
    ).toBe(true);
    expect(
      hasImportFrom({
        expected: "pkg",
        importKind: "type",
        context,
        fileStructure,
      })
    ).toBe(true);
    expect(
      hasImportFrom({
        expected: "pkg/*",
        importKind: "value",
        context,
        fileStructure,
      })
    ).toBe(false);
  });

  it("treats side-effect imports as value sources only", () => {
    expect(
      hasImportFrom({
        expected: "./setup",
        importKind: "value",
        context,
        fileStructure,
      })
    ).toBe(true);
    expect(
      hasImportFrom({
        expected: "./setup",
        importKind: "type",
        context,
        fileStructure,
      })
    ).toBe(false);
  });
});
