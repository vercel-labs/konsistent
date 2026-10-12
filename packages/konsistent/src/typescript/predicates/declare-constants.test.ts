import { describe, expect, it } from "vitest";
import type { PredicateContext } from "../../core/context.js";
import { parseFileStructure } from "../parser.js";
import { checkDeclareConstants } from "./declare-constants.js";

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
      return t.replace(/\$\{(\w+)\}/g, (match, name) => {
        const placeholder = placeholders[name];
        return placeholder ? placeholder.toString() : match;
      });
    },
  };
}

function parseSource(opts: { source: string }) {
  return parseFileStructure({ filePath: "src/index.ts", source: opts.source });
}

describe("checkDeclareConstants", () => {
  it("passes for local constant declarations", () => {
    const result = checkDeclareConstants({
      context: createMockContext({ path: "src/index.ts" }),
      expected: ["thingId"],
      fileStructure: parseSource({
        source: "const thingId = 'thing';",
      }),
    });
    expect(result).toEqual([]);
  });

  it("rejects named exported local constants", () => {
    const result = checkDeclareConstants({
      context: createMockContext({ path: "src/index.ts" }),
      expected: ["thingId"],
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

  it("validates a configured constant schema", () => {
    const result = checkDeclareConstants({
      context: createMockContext({ path: "src/index.ts" }),
      expected: [
        {
          name: "modes",
          schema: {
            items: { type: "string" },
            type: "array",
          },
        },
      ],
      fileStructure: parseSource({
        source: "const modes: readonly string[] = [];",
      }),
    });
    expect(result).toEqual([]);
  });

  it("validates type references in a configured array schema", () => {
    const result = checkDeclareConstants({
      context: createMockContext({
        path: "src/index.ts",
        placeholders: {
          authType: { toString: () => "Readonly<MyAuth>" },
        },
      }),
      expected: [
        {
          name: "authProviders",
          schema: {
            items: "${authType}",
            type: "array",
          },
        },
      ],
      fileStructure: parseSource({
        source: "const authProviders: ReadonlyArray<Readonly<MyAuth>> = [];",
      }),
    });
    expect(result).toEqual([]);
  });

  it("reports a mismatched constant schema", () => {
    const result = checkDeclareConstants({
      context: createMockContext({ path: "src/index.ts" }),
      expected: [{ name: "port", schema: { type: "number" } }],
      fileStructure: parseSource({ source: 'const port: string = "3000";' }),
    });
    expect(result).toHaveLength(1);
    expect(result[0].message).toBe('Constant "port" must be of type "number"');
  });

  it("requires an explicit annotation when a schema is configured", () => {
    const result = checkDeclareConstants({
      context: createMockContext({ path: "src/index.ts" }),
      expected: [{ name: "port", schema: { type: "number" } }],
      fileStructure: parseSource({ source: "const port = 3000;" }),
    });
    expect(result).toHaveLength(1);
    expect(result[0].message).toBe(
      'Constant "port" must have an explicit type annotation'
    );
  });

  it("validates an exact template-expanded type annotation", () => {
    const result = checkDeclareConstants({
      context: createMockContext({
        path: "src/index.ts",
        placeholders: { name: { toString: () => "Module" } },
      }),
      expected: [{ name: "settings", type: "Readonly<${name}Settings>" }],
      fileStructure: parseSource({
        source: "const settings: Readonly<ModuleSettings> = {};",
      }),
    });
    expect(result).toEqual([]);
  });

  it("reports a mismatched exact type annotation", () => {
    const result = checkDeclareConstants({
      context: createMockContext({ path: "src/index.ts" }),
      expected: [{ name: "settings", type: "Readonly<ModuleSettings>" }],
      fileStructure: parseSource({
        source: "const settings: ModuleSettings = {};",
      }),
    });
    expect(result[0].message).toBe(
      'Constant "settings" must have type "Readonly<ModuleSettings>"'
    );
  });

  it("requires an explicit annotation for an exact type constraint", () => {
    const result = checkDeclareConstants({
      context: createMockContext({ path: "src/index.ts" }),
      expected: [{ name: "settings", type: "ModuleSettings" }],
      fileStructure: parseSource({ source: "const settings = {};" }),
    });
    expect(result[0].message).toBe(
      'Constant "settings" must have an explicit type annotation'
    );
  });
});
