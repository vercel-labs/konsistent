import { describe, expect, it } from "vitest";
import type { PredicateContext } from "../../core/context.js";
import { parseFileStructure } from "../parser.js";
import { checkDeclareFunctions } from "./declare-functions.js";

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

describe("checkDeclareFunctions", () => {
  it("passes for local function declarations", () => {
    const result = checkDeclareFunctions({
      expected: ["createThing"],
      context: createMockContext({ path: "src/index.ts" }),
      fileStructure: parseSource({
        source: "function createThing() {}",
      }),
    });
    expect(result).toEqual([]);
  });

  it("rejects default exported local functions", () => {
    const result = checkDeclareFunctions({
      expected: ["createThing"],
      context: createMockContext({ path: "src/index.ts" }),
      fileStructure: parseSource({
        source: "function createThing() {}\nexport default createThing;",
      }),
    });
    expect(result).toHaveLength(1);
    expect(result[0].message).toBe(
      'Local function declaration "createThing" must not be exported'
    );
  });

  it("checks local function signatures", () => {
    const result = checkDeclareFunctions({
      expected: [
        {
          name: "createThing",
          receiveParamOfType: "ThingConfig",
          returnValueOfType: "Thing",
        },
      ],
      context: createMockContext({ path: "src/index.ts" }),
      fileStructure: parseSource({
        source:
          "function createThing(config: WrongConfig): WrongThing { return {} as WrongThing; }",
      }),
    });
    expect(result).toHaveLength(2);
    expect(result[0].message).toBe(
      'Function "createThing" must receive a parameter of type "ThingConfig"'
    );
    expect(result[1].message).toBe(
      'Function "createThing" must return value of type "Thing"'
    );
  });

  it("checks ordered local function params", () => {
    const result = checkDeclareFunctions({
      expected: [
        {
          name: "createThing",
          receiveParamsOfTypes: ["ThingConfig", "ThingContext"],
        },
      ],
      context: createMockContext({ path: "src/index.ts" }),
      fileStructure: parseSource({
        source:
          "function createThing(config: ThingConfig, ctx: WrongContext) {}",
      }),
    });
    expect(result).toHaveLength(1);
    expect(result[0].message).toBe(
      'Function "createThing" parameter 2 must be of type "ThingContext"'
    );
  });
});
