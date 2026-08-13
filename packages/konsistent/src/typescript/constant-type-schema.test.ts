import type { ConstantValueSchemaV1 } from "@konsistent/convention";
import { describe, expect, it } from "vitest";
import {
  matchConstantTypeSchema,
  matchTypeDefinitionSchema,
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

describe("constant type schemas", () => {
  it.each([
    "string",
    "number",
    "boolean",
    "null",
  ])("matches the %s scalar type", (type) => {
    expect(
      matches({
        type,
        schema: { type: type as "string" },
      })
    ).toBe(true);
  });

  it("requires scalar types to match exactly", () => {
    expect(matches({ type: '"value"', schema: { type: "string" } })).toBe(
      false
    );
  });

  it("matches exact homogeneous enum values regardless of order", () => {
    expect(
      matches({
        type: '"production" | "development"',
        schema: {
          type: "string",
          enum: ["development", "production"],
        },
      })
    ).toBe(true);
  });

  it("matches a null enum", () => {
    expect(
      matches({ type: "null", schema: { type: "null", enum: [null] } })
    ).toBe(true);
  });

  it("rejects enum omissions and additions", () => {
    const schema = {
      type: "string" as const,
      enum: ["development", "production"],
    };
    expect(matches({ type: '"development"', schema })).toBe(false);
    expect(
      matches({ type: '"development" | "production" | "test"', schema })
    ).toBe(false);
  });

  it.each([
    "string[]",
    "Array<string>",
    "readonly string[]",
    "ReadonlyArray<string>",
  ])("matches the supported array annotation %s", (type) => {
    expect(
      matches({ type, schema: { type: "array", items: { type: "string" } } })
    ).toBe(true);
  });

  it.each([
    "number[]",
    "[string, string]",
    'Array<"value">',
  ])("rejects non-matching or unsupported array annotation %s", (type) => {
    expect(
      matches({
        type,
        schema: { type: "array", items: { type: "string" } },
      })
    ).toBe(false);
  });

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
        type: entry.annotation,
        schema: { type: "array", items: { type: entry.itemType } },
      })
    ).toBe(true);
  });

  it("compares array item type references exactly", () => {
    expect(
      matches({
        type: "Array<Readonly< MyType >>",
        schema: { type: "array", items: { type: "Readonly<MyType>" } },
      })
    ).toBe(false);
  });

  it("matches required, optional, typed, and unconstrained properties", () => {
    expect(
      matches({
        type: "{ name: string; enabled?: boolean; metadata: unknown }",
        schema: {
          type: "object",
          properties: {
            name: { type: "string" },
            enabled: { type: "boolean" },
            metadata: {},
          },
          required: ["name", "metadata"],
          additionalProperties: false,
        },
      })
    ).toBe(true);
  });

  it("matches exact type references on object properties", () => {
    expect(
      matches({
        type: "{ auth: Readonly<MyAuth>; modelId: string }",
        schema: {
          type: "object",
          properties: {
            auth: { type: "Readonly<MyAuth>" },
            modelId: { type: "string" },
          },
          required: ["auth", "modelId"],
        },
      })
    ).toBe(true);
  });

  it("compares object property type references exactly", () => {
    expect(
      matches({
        type: "{ auth: Readonly< MyAuth > }",
        schema: {
          type: "object",
          properties: { auth: { type: "Readonly<MyAuth>" } },
          required: ["auth"],
        },
      })
    ).toBe(false);
  });

  it.each([
    "object",
    "MyAuth | null",
    "[MyAuth]",
    "{ id: string }",
  ])("rejects unsupported object property type %s", (type) => {
    expect(
      matches({
        type: `{ auth: ${type} }`,
        schema: {
          type: "object",
          properties: { auth: { type: "MyAuth" } },
          required: ["auth"],
        },
      })
    ).toBe(false);
  });

  it("matches quoted empty property names", () => {
    expect(
      matches({
        type: '{ "": string }',
        schema: {
          type: "object",
          properties: { "": { type: "string" } },
          required: [""],
        },
      })
    ).toBe(true);
  });

  it("enforces required and additional object properties", () => {
    const schema = {
      type: "object" as const,
      properties: { name: { type: "string" as const } },
      required: ["name"],
      additionalProperties: false,
    };
    expect(matches({ type: "{ name?: string }", schema })).toBe(false);
    expect(matches({ type: "{ name: string; extra: number }", schema })).toBe(
      false
    );
  });

  it("requires configured non-required properties to exist and be optional", () => {
    const schema = {
      type: "object" as const,
      properties: { name: { type: "string" as const } },
    };
    expect(matches({ type: "{ name?: string }", schema })).toBe(true);
    expect(matches({ type: "{}", schema })).toBe(false);
    expect(matches({ type: "{ name: string }", schema })).toBe(false);
  });

  it("reports exact object property declaration mismatches", () => {
    const schema = {
      type: "object" as const,
      properties: { name: { type: "string" as const } },
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
        type: "{ name: string; extra: number }",
        schema: {
          type: "object",
          properties: { name: { type: "string" } },
          required: ["name"],
        },
      })
    ).toBe(true);
  });

  it.each([
    "Config",
    "{ run(): void }",
    "{ [key: string]: string }",
  ])("rejects unsupported annotation %s", (type) => {
    expect(matches({ type, schema: { type: "object", properties: {} } })).toBe(
      false
    );
  });

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
    type: "object" as const,
    properties: {
      model: { type: "string" as const },
      timeout: { type: "number" as const },
    },
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
        type: "object",
        properties: { enabled: { type: "boolean" } },
      },
      source: "interface Settings { enabled?: boolean }",
    });
    expect(result).toEqual({ matches: true });
  });

  it("matches type references in a type definition", () => {
    const result = matchDefinition({
      name: "Settings",
      schema: {
        type: "object",
        properties: { auth: { type: "Readonly<MyAuth>" } },
        required: ["auth"],
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
      schema: { type: "object", properties: {} },
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
        schema: { type: "object", properties: {} },
      })
    ).toEqual({
      matches: false,
      reason: "must have a local type definition",
    });
  });
});
