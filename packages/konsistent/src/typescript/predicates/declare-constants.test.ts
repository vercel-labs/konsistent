import { describe, expect, it } from "vitest";
import type { PredicateContext } from "../../core/context.js";
import { parseFileStructure } from "../parser.js";
import { checkDeclareConstants } from "./declare-constants.js";

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

describe("checkDeclareConstants", () => {
  it("passes for local constant declarations", () => {
    const result = checkDeclareConstants({
      expected: ["thingId"],
      context: createMockContext({ path: "src/index.ts" }),
      fileStructure: parseSource({
        source: "const thingId = 'thing';",
      }),
    });
    expect(result).toEqual([]);
  });

  it("rejects named exported local constants", () => {
    const result = checkDeclareConstants({
      expected: ["thingId"],
      context: createMockContext({ path: "src/index.ts" }),
      fileStructure: parseSource({
        source: "const thingId = 'thing';\nexport { thingId };",
      }),
    });
    expect(result).toHaveLength(1);
    expect(result[0].message).toBe(
      'Local constant declaration "thingId" must not be exported'
    );
    expect(result[0].predicateName).toBe("declareConstants");
  });
});
