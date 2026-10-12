import { describe, expect, it } from "vitest";
import type { PredicateContext } from "../../core/context.js";
import { parseFileStructure } from "../parser.js";
import { checkDeclareTypes } from "./declare-types.js";

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

describe("checkDeclareTypes", () => {
  it("passes for local type declarations", () => {
    const fileStructure = parseSource({
      source: "interface Thing {}\ntype ThingInput = string;",
    });
    const result = checkDeclareTypes({
      context: createMockContext({ path: "src/index.ts" }),
      expected: ["Thing", "ThingInput"],
      fileStructure,
    });
    expect(result).toEqual([]);
  });

  it("rejects exported local type declarations", () => {
    const result = checkDeclareTypes({
      context: createMockContext({ path: "src/index.ts" }),
      expected: ["ThingInput"],
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
      context: createMockContext({
        path: "src/index.ts",
        placeholders: {
          authType: { toString: () => "Namespace.MyAuth" },
        },
      }),
      expected: [
        {
          name: "Settings",
          schema: {
            properties: { model: { type: "string" } },
            type: "object",
          },
        },
        {
          name: "Options",
          schema: {
            properties: {
              auth: "${authType}",
              enabled: { type: "boolean" },
            },
            type: "object",
          },
        },
      ],
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
      context: createMockContext({ path: "src/index.ts" }),
      expected: [
        {
          name: "Settings",
          schema: {
            properties: { timeout: { type: "number" } },
            type: "object",
          },
        },
      ],
      fileStructure: parseSource({
        source: "type Settings = { model?: string };",
      }),
    });
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      column: 1,
      line: 1,
      message: 'Type "Settings" must define property "timeout"',
      predicateName: "declareTypes",
    });
  });

  it("validates an exact template-expanded type alias expression", () => {
    const result = checkDeclareTypes({
      context: createMockContext({
        path: "src/index.ts",
        placeholders: { name: { toString: () => "Shared" } },
      }),
      expected: [
        {
          name: "Settings",
          type: "${name}Settings<'generic-value'> | undefined",
        },
      ],
      fileStructure: parseSource({
        source: "type Settings = SharedSettings<'generic-value'> | undefined;",
      }),
    });
    expect(result).toEqual([]);
  });

  it("reports a mismatched exact type alias expression", () => {
    const result = checkDeclareTypes({
      context: createMockContext({ path: "src/index.ts" }),
      expected: [{ name: "Settings", type: "SharedSettings<'public'>" }],
      fileStructure: parseSource({
        source: "type Settings = SharedSettings<'private'>;",
      }),
    });
    expect(result[0].message).toBe(
      `Type "Settings" must have type "SharedSettings<'public'>"`
    );
  });

  it("does not treat an interface as an exact type alias expression", () => {
    const result = checkDeclareTypes({
      context: createMockContext({ path: "src/index.ts" }),
      expected: [{ name: "Settings", type: "SharedSettings" }],
      fileStructure: parseSource({ source: "interface Settings {}" }),
    });
    expect(result[0].message).toBe('Type "Settings" must be a type alias');
  });
});
