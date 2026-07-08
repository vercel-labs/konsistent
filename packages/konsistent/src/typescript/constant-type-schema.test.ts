import type { ConstantValueSchemaV1 } from "@konsistent/convention";
import { describe, expect, it } from "vitest";
import { matchConstantTypeSchema } from "./constant-type-schema.js";
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
