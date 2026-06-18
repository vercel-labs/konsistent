import { describe, expect, it } from "vitest";
import type { PredicateContext } from "../../core/context.js";
import { parseFileStructure } from "../parser.js";
import { checkDeclareTypes } from "./declare-types.js";

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

describe("checkDeclareTypes", () => {
  it("passes for local type declarations", () => {
    const fileStructure = parseSource({
      source: "interface Thing {}\ntype ThingInput = string;",
    });
    const result = checkDeclareTypes({
      expected: ["Thing", "ThingInput"],
      context: createMockContext({ path: "src/index.ts" }),
      fileStructure,
    });
    expect(result).toEqual([]);
  });

  it("rejects exported local type declarations", () => {
    const result = checkDeclareTypes({
      expected: ["ThingInput"],
      context: createMockContext({ path: "src/index.ts" }),
      fileStructure: parseSource({
        source: "export type ThingInput = string;",
      }),
    });
    expect(result).toHaveLength(1);
    expect(result[0].message).toBe(
      'Local type declaration "ThingInput" must not be exported'
    );
    expect(result[0].predicateName).toBe("declareTypes");
  });
});
