import { describe, expect, it } from "vitest";
import type { PredicateContext } from "../../core/context.js";
import { parseFileStructure } from "../parser.js";
import { checkDeclareInterfaces } from "./declare-interfaces.js";

function createMockContext(opts: {
  path: string;
  placeholders?: Record<string, { toString(): string }>;
}): PredicateContext {
  const placeholders = opts.placeholders ?? {};
  return {
    path: opts.path,
    placeholders: placeholders as PredicateContext["placeholders"],
    resolveTemplate(t: string): string {
      return t.replace(/\$\{(\w+)\}/g, (_match, name) => {
        const ph = placeholders[name];
        return ph ? ph.toString() : _match;
      });
    },
    fileExists: () => false,
    readDir: () => [],
  };
}

function parseSource(opts: { source: string }) {
  return parseFileStructure({ source: opts.source, filePath: "src/index.ts" });
}

describe("checkDeclareInterfaces", () => {
  it("passes for local interface declarations", () => {
    const result = checkDeclareInterfaces({
      expected: ["Thing"],
      context: createMockContext({ path: "src/index.ts" }),
      fileStructure: parseSource({
        source: "interface Thing {}",
      }),
    });
    expect(result).toEqual([]);
  });

  it("checks local interface extends clauses", () => {
    const result = checkDeclareInterfaces({
      expected: [{ name: "Thing", extend: "BaseThing" }],
      context: createMockContext({ path: "src/index.ts" }),
      fileStructure: parseSource({
        source: "interface Thing extends OtherThing {}",
      }),
    });
    expect(result).toHaveLength(1);
    expect(result[0].message).toBe('Interface "Thing" must extend "BaseThing"');
  });

  it("resolves declaration templates", () => {
    const result = checkDeclareInterfaces({
      expected: [{ name: "${name}Config" }],
      context: createMockContext({
        path: "src/index.ts",
        placeholders: { name: { toString: () => "Thing" } },
      }),
      fileStructure: parseSource({
        source: "interface ThingConfig {}",
      }),
    });
    expect(result).toEqual([]);
  });
});
