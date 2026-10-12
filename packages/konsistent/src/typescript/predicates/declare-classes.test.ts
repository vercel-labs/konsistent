import { describe, expect, it } from "vitest";
import type { PredicateContext } from "../../core/context.js";
import { parseFileStructure } from "../parser.js";
import { checkDeclareClasses } from "./declare-classes.js";

function createMockContext(opts: { path: string }): PredicateContext {
  return {
    directoryExists: () => false,
    fileExists: () => false,
    path: opts.path,
    placeholders: {} as PredicateContext["placeholders"],
    readDir: () => [],
    resolveTemplate: (t: string) => t,
  };
}

function parseSource(opts: { source: string }) {
  return parseFileStructure({ filePath: "src/index.ts", source: opts.source });
}

describe("checkDeclareClasses", () => {
  it("passes for local class declarations", () => {
    const result = checkDeclareClasses({
      context: createMockContext({ path: "src/index.ts" }),
      expected: ["Thing"],
      fileStructure: parseSource({
        source: "class Thing {}",
      }),
    });
    expect(result).toEqual([]);
  });

  it("checks local class heritage", () => {
    const result = checkDeclareClasses({
      context: createMockContext({ path: "src/index.ts" }),
      expected: [
        { extend: "BaseThing", implement: ["Serializable"], name: "Thing" },
      ],
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
