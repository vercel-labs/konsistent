import { describe, expect, it } from "vitest";
import type { PredicateContext } from "../../core/context.js";
import { parseFileStructure } from "../parser.js";
import { checkDeclareClasses } from "./declare-classes.js";

function createMockContext(opts: { path: string }): PredicateContext {
  return {
    path: opts.path,
    placeholders: {} as PredicateContext["placeholders"],
    resolveTemplate: (t: string) => t,
    fileExists: () => false,
    readDir: () => [],
  };
}

function parseSource(opts: { source: string }) {
  return parseFileStructure({ source: opts.source, filePath: "src/index.ts" });
}

describe("checkDeclareClasses", () => {
  it("passes for local class declarations", () => {
    const result = checkDeclareClasses({
      expected: ["Thing"],
      context: createMockContext({ path: "src/index.ts" }),
      fileStructure: parseSource({
        source: "class Thing {}",
      }),
    });
    expect(result).toEqual([]);
  });

  it("checks local class heritage", () => {
    const result = checkDeclareClasses({
      expected: [
        { name: "Thing", extend: "BaseThing", implement: ["Serializable"] },
      ],
      context: createMockContext({ path: "src/index.ts" }),
      fileStructure: parseSource({
        source: "class Thing extends OtherThing {}",
      }),
    });
    expect(result).toHaveLength(2);
    expect(result[0].message).toBe('Class "Thing" must extend "BaseThing"');
    expect(result[1].message).toBe(
      'Class "Thing" must implement "Serializable"'
    );
  });
});
