import type { ConstantValueSchemaV1 } from "@konsistent/convention";
import { describe, expect, it } from "vitest";
import {
  matchConstantTypeSchema,
  matchTypeDefinitionSchema,
  matchTypeExpression,
} from "./constant-type-schema.js";
import { parseFileStructure } from "./parser.js";

function getTypeInfo(opts: { type: string }) {
  return parseFileStructure({ source: `const value: ${opts.type} = null;` })
    .constants[0].typeInfo;
}

function matches(opts: {
  type: string;
  schema: ConstantValueSchemaV1;
}): boolean {
  return matchConstantTypeSchema({
    actual: getTypeInfo({ type: opts.type }),
    schema: opts.schema,
  }).matches;
}

function matchDefinition(opts: {
  name: string;
  schema: ConstantValueSchemaV1;
  source: string;
}) {
  const fileStructure = parseFileStructure({ source: opts.source });
  const definition =
    fileStructure.typeAliases.find((item) => item.name === opts.name) ??
    fileStructure.interfaces.find((item) => item.name === opts.name);
  return matchTypeDefinitionSchema({
    actual: definition?.typeInfo,
    schema: opts.schema,
  });
}

describe("exact type expression matching", () => {
  it("ignores formatting whitespace and comments", () => {
    expect(
      matchTypeExpression({
        actual: `Prettify<
          /* Type expressions may be formatted across multiple lines. */
          HarnessV1SandboxSessionCreateOptions<VercelCreationSettings> & {
            sandbox?: never;
          }
        >`,
        expected:
          "Prettify<HarnessV1SandboxSessionCreateOptions<VercelCreationSettings> & {sandbox?: never;}>",
        missingReason: "must have an explicit type annotation",
      })
    ).toEqual({ matches: true });
  });

  it("preserves literal contents, aliases, and grouping", () => {
    const match = (opts: { actual: string; expected: string }) =>
      matchTypeExpression({
        ...opts,
        missingReason: "must have an explicit type annotation",
      });

    expect(match({ actual: '"a b"', expected: '"ab"' }).matches).toBe(false);
    expect(
      match({ actual: "ModuleSettings", expected: "{ enabled: boolean }" })
        .matches
    ).toBe(false);
    expect(
      match({ actual: "A | (B & C)", expected: "A | B & C" }).matches
    ).toBe(false);
  });

  it("falls back to exact text matching when parsing fails", () => {
    expect(
      matchTypeExpression({
        actual: "ModuleSettings<",
        expected: "ModuleSettings<",
        missingReason: "must have an explicit type annotation",
      })
    ).toEqual({ matches: true });
    expect(
      matchTypeExpression({
        actual: "ModuleSettings<",
        expected: "ModuleSettings< ",
        missingReason: "must have an explicit type annotation",
      }).matches
    ).toBe(false);
  });
});

describe("constant type schemas", () => {
  it.each(["string", "number", "boolean", "null"])(
    "matches the %s scalar type",
    (type) => {
      expect(
        matches({
          schema: { type: type as "string" },
          type,
        })
      ).toBe(true);
    }
  );

  it("requires scalar types to match exactly", () => {
    expect(matches({ schema: { type: "string" }, type: '"value"' })).toBe(
      false
    );
  });

  it("matches exact homogeneous enum values regardless of order", () => {
    expect(
      matches({
        schema: {
          enum: ["development", "production"],
          type: "string",
        },
        type: '"production" | "development"',
      })
    ).toBe(true);
  });

  it("matches a null enum", () => {
    expect(
      matches({ schema: { enum: [null], type: "null" }, type: "null" })
    ).toBe(true);
  });

  it("rejects enum omissions and additions", () => {
    const schema = {
      enum: ["development", "production"],
      type: "string" as const,
    };
    expect(matches({ schema, type: '"development"' })).toBe(false);
    expect(
      matches({ schema, type: '"development" | "production" | "test"' })
    ).toBe(false);
  });

  it.each([
    "string[]",
    "Array<string>",
    "readonly string[]",
    "ReadonlyArray<string>",
  ])("matches the supported array annotation %s", (type) => {
    expect(
      matches({ schema: { items: { type: "string" }, type: "array" }, type })
    ).toBe(true);
  });

  it.each(["number[]", "[string, string]", 'Array<"value">'])(
    "rejects non-matching or unsupported array annotation %s",
    (type) => {
      expect(
        matches({
          schema: { items: { type: "string" }, type: "array" },
          type,
        })
      ).toBe(false);
    }
  );

  it.each([
    { annotation: "MyType[]", itemType: "MyType" },
    { annotation: "Array<Namespace.MyType>", itemType: "Namespace.MyType" },
    {
      annotation: "readonly Readonly<MyType>[]",
      itemType: "Readonly<MyType>",
    },
    {
      annotation: "ReadonlyArray<ReadonlyMap<Key, Value>>",
      itemType: "ReadonlyMap<Key, Value>",
    },
  ])("matches an array containing type references for $annotation", (entry) => {
    expect(
      matches({
        schema: { items: entry.itemType, type: "array" },
        type: entry.annotation,
      })
    ).toBe(true);
  });

  it("compares array item type references exactly", () => {
    expect(
      matches({
        schema: { items: "Readonly<MyType>", type: "array" },
        type: "Array<Readonly< MyType >>",
      })
    ).toBe(false);
  });

  it("matches required, optional, typed, and unconstrained properties", () => {
    expect(
      matches({
        schema: {
          additionalProperties: false,
          properties: {
            enabled: { type: "boolean" },
            metadata: {},
            name: { type: "string" },
          },
          required: ["name", "metadata"],
          type: "object",
        },
        type: "{ name: string; enabled?: boolean; metadata: unknown }",
      })
    ).toBe(true);
  });

  it("matches exact type references on object properties", () => {
    expect(
      matches({
        schema: {
          properties: {
            auth: "Readonly<MyAuth>",
            modelId: { type: "string" },
          },
          required: ["auth", "modelId"],
          type: "object",
        },
        type: "{ auth: Readonly<MyAuth>; modelId: string }",
      })
    ).toBe(true);
  });

  it("compares object property type references exactly", () => {
    expect(
      matches({
        schema: {
          properties: { auth: "Readonly<MyAuth>" },
          required: ["auth"],
          type: "object",
        },
        type: "{ auth: Readonly< MyAuth > }",
      })
    ).toBe(false);
  });

  it.each(["object", "MyAuth | null", "[MyAuth]", "{ id: string }"])(
    "rejects unsupported object property type %s",
    (type) => {
      expect(
        matches({
          schema: {
            properties: { auth: "MyAuth" },
            required: ["auth"],
            type: "object",
          },
          type: `{ auth: ${type} }`,
        })
      ).toBe(false);
    }
  );

  it("matches quoted empty property names", () => {
    expect(
      matches({
        schema: {
          properties: { "": { type: "string" } },
          required: [""],
          type: "object",
        },
        type: '{ "": string }',
      })
    ).toBe(true);
  });

  it("enforces required and additional object properties", () => {
    const schema = {
      additionalProperties: false,
      properties: { name: { type: "string" as const } },
      required: ["name"],
      type: "object" as const,
    };
    expect(matches({ schema, type: "{ name?: string }" })).toBe(false);
    expect(matches({ schema, type: "{ name: string; extra: number }" })).toBe(
      false
    );
  });

  it("requires configured non-required properties to exist and be optional", () => {
    const schema = {
      properties: { name: { type: "string" as const } },
      type: "object" as const,
    };
    expect(matches({ schema, type: "{ name?: string }" })).toBe(true);
    expect(matches({ schema, type: "{}" })).toBe(false);
    expect(matches({ schema, type: "{ name: string }" })).toBe(false);
  });

  it("reports exact object property declaration mismatches", () => {
    const schema = {
      properties: { name: { type: "string" as const } },
      type: "object" as const,
    };
    expect(
      matchConstantTypeSchema({ actual: getTypeInfo({ type: "{}" }), schema })
    ).toEqual({
      matches: false,
      reason: 'must define property "name"',
    });
    expect(
      matchConstantTypeSchema({
        actual: getTypeInfo({ type: "{ name: string }" }),
        schema,
      })
    ).toEqual({
      matches: false,
      reason: 'property "name" must be optional',
    });
  });

  it("allows additional properties by default", () => {
    expect(
      matches({
        schema: {
          properties: { name: { type: "string" } },
          required: ["name"],
          type: "object",
        },
        type: "{ name: string; extra: number }",
      })
    ).toBe(true);
  });

  it.each(["Config", "{ run(): void }", "{ [key: string]: string }"])(
    "rejects unsupported annotation %s",
    (type) => {
      expect(
        matches({ schema: { properties: {}, type: "object" }, type })
      ).toBe(false);
    }
  );

  it("rejects constants without explicit annotations", () => {
    const result = matchConstantTypeSchema({
      actual: parseFileStructure({ source: 'const value = "value";' })
        .constants[0].typeInfo,
      schema: { type: "string" },
    });
    expect(result).toEqual({
      matches: false,
      reason: "must have an explicit type annotation",
    });
  });
});

describe("type definition schemas", () => {
  const partialSettingsSchema = {
    properties: {
      model: { type: "string" as const },
      timeout: { type: "number" as const },
    },
    type: "object" as const,
  };

  it("partially matches configured optional type alias properties", () => {
    const result = matchDefinition({
      name: "ModuleSettings",
      schema: partialSettingsSchema,
      source: `
        type ModuleSettings = {
          model?: string;
          timeout?: number;
          reasoning?: "low" | "medium" | "high";
        };
      `,
    });
    expect(result).toEqual({ matches: true });
  });

  it("rejects a type alias missing a configured optional property", () => {
    const result = matchDefinition({
      name: "ModuleSettings",
      schema: partialSettingsSchema,
      source: `
        type ModuleSettings = {
          model?: string;
          reasoning?: "low" | "medium" | "high";
        };
      `,
    });
    expect(result).toEqual({
      matches: false,
      reason: 'must define property "timeout"',
    });
  });

  it("matches directly declared interface properties", () => {
    const result = matchDefinition({
      name: "Settings",
      schema: {
        properties: { enabled: { type: "boolean" } },
        type: "object",
      },
      source: "interface Settings { enabled?: boolean }",
    });
    expect(result).toEqual({ matches: true });
  });

  it("matches type references in a type definition", () => {
    const result = matchDefinition({
      name: "Settings",
      schema: {
        properties: { auth: "Readonly<MyAuth>" },
        required: ["auth"],
        type: "object",
      },
      source: "type Settings = { auth: Readonly<MyAuth> }",
    });
    expect(result).toEqual({ matches: true });
  });

  it.each([
    "type Settings = BaseSettings;",
    "interface Settings extends BaseSettings { enabled?: boolean }",
    "interface Settings { run(): void }",
  ])("rejects unsupported type definition %s", (source) => {
    const result = matchDefinition({
      name: "Settings",
      schema: { properties: {}, type: "object" },
      source,
    });
    expect(result).toEqual({
      matches: false,
      reason: "uses an unsupported type definition",
    });
  });

  it("requires a local type definition", () => {
    expect(
      matchTypeDefinitionSchema({
        actual: undefined,
        schema: { properties: {}, type: "object" },
      })
    ).toEqual({
      matches: false,
      reason: "must have a local type definition",
    });
  });
});
