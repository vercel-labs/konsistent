import { describe, expect, it } from "vitest";
import type { PredicateContext } from "../../core/context.js";
import { parseFileStructure } from "../parser.js";
import { checkDeclareInterfaces } from "./declare-interfaces.js";

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

function parseSource(opts: { source: string }) {
  return parseFileStructure({ filePath: "src/index.ts", source: opts.source });
}

describe("checkDeclareInterfaces", () => {
  it("passes for local interface declarations", () => {
    const result = checkDeclareInterfaces({
      context: createMockContext({ path: "src/index.ts" }),
      expected: ["Thing"],
      fileStructure: parseSource({
        source: "interface Thing {}",
      }),
    });
    expect(result).toEqual([]);
  });

  it("checks local interface extends clauses", () => {
    const result = checkDeclareInterfaces({
      context: createMockContext({ path: "src/index.ts" }),
      expected: [{ extend: "BaseThing", name: "Thing" }],
      fileStructure: parseSource({
        source: "interface Thing extends OtherThing {}",
      }),
    });
    expect(result).toHaveLength(1);
    expect(result[0].message).toBe('Interface "Thing" must extend "BaseThing"');
  });

  it("resolves declaration templates", () => {
    const result = checkDeclareInterfaces({
      context: createMockContext({
        path: "src/index.ts",
        placeholders: { name: { toString: () => "Thing" } },
      }),
      expected: [{ name: "${name}Config" }],
      fileStructure: parseSource({
        source: "interface ThingConfig {}",
      }),
    });
    expect(result).toEqual([]);
  });
});
