import { describe, expect, it } from "vitest";
import type { PredicateContext } from "../core/context.js";
import { hasImport, hasImportFrom } from "./import-matcher.js";
import { parseFileStructure } from "./parser.js";

function createContext(opts: {
  placeholders?: Record<string, { toString: () => string }>;
}): PredicateContext {
  const placeholders = opts.placeholders ?? {};
  return {
    directoryExists: () => false,
    fileExists: () => false,
    path: "src/index.ts",
    placeholders: placeholders as PredicateContext["placeholders"],
    readDir: () => [],
    resolveTemplate(template: string): string {
      return template.replace(
        /\$\{(\w+)\}/g,
        (match, name) => placeholders[name]?.toString() ?? match
      );
    },
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
        context,
        expected: { from: "pkg", name: "sourceValue" },
        fileStructure,
        importKind: "value",
      })
    ).toBe(true);
    expect(
      hasImport({
        context,
        expected: "localValue",
        fileStructure,
        importKind: "value",
      })
    ).toBe(false);
  });

  it("keeps value and type imports separate", () => {
    expect(
      hasImport({
        context,
        expected: "SourceType",
        fileStructure,
        importKind: "type",
      })
    ).toBe(true);
    expect(
      hasImport({
        context,
        expected: "SourceType",
        fileStructure,
        importKind: "value",
      })
    ).toBe(false);
  });

  it("resolves placeholders in names and sources", () => {
    const placeholderContext = createContext({
      placeholders: {
        source: { toString: () => "pkg" },
        symbol: { toString: () => "sourceValue" },
      },
    });
    expect(
      hasImport({
        context: placeholderContext,
        expected: { from: "${source}", name: "${symbol}" },
        fileStructure,
        importKind: "value",
      })
    ).toBe(true);
  });

  it("matches exact value and type import sources", () => {
    expect(
      hasImportFrom({
        context,
        expected: "pkg",
        fileStructure,
        importKind: "value",
      })
    ).toBe(true);
    expect(
      hasImportFrom({
        context,
        expected: "pkg",
        fileStructure,
        importKind: "type",
      })
    ).toBe(true);
    expect(
      hasImportFrom({
        context,
        expected: "pkg/*",
        fileStructure,
        importKind: "value",
      })
    ).toBe(false);
  });

  it("treats side-effect imports as value sources only", () => {
    expect(
      hasImportFrom({
        context,
        expected: "./setup",
        fileStructure,
        importKind: "value",
      })
    ).toBe(true);
    expect(
      hasImportFrom({
        context,
        expected: "./setup",
        fileStructure,
        importKind: "type",
      })
    ).toBe(false);
  });
});
