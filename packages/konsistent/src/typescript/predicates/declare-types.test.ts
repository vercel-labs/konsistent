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

  it("validates schemas for local type aliases and interfaces", () => {
    const result = checkDeclareTypes({
      expected: [
        {
          name: "Settings",
          schema: {
            type: "object",
            properties: { model: { type: "string" } },
          },
        },
        {
          name: "Options",
          schema: {
            type: "object",
            properties: {
              enabled: { type: "boolean" },
              auth: { type: "Namespace.MyAuth" },
            },
          },
        },
      ],
      context: createMockContext({ path: "src/index.ts" }),
      fileStructure: parseSource({
        source: [
          "type Settings = { model?: string; extra?: number };",
          "interface Options { enabled?: boolean; auth?: Namespace.MyAuth }",
        ].join("\n"),
      }),
    });
    expect(result).toEqual([]);
  });

  it("reports schema mismatches for local type definitions", () => {
    const result = checkDeclareTypes({
      expected: [
        {
          name: "Settings",
          schema: {
            type: "object",
            properties: { timeout: { type: "number" } },
          },
        },
      ],
      context: createMockContext({ path: "src/index.ts" }),
      fileStructure: parseSource({
        source: "type Settings = { model?: string };",
      }),
    });
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      message: 'Type "Settings" must define property "timeout"',
      predicateName: "declareTypes",
      line: 1,
      column: 1,
    });
  });
});
