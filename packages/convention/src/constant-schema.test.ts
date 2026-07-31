import { describe, expect, it } from "vitest";
import {
  ConstantValueSchemaV1Schema,
  ExportTypeDefinitionV1Schema,
  TypeDefinitionV1Schema,
} from "./constant-schema.js";

describe("ConstantValueSchemaV1Schema", () => {
  it.each([
    { type: "string" },
    { type: "number", enum: [1, 2] },
    { type: "array", items: { type: "boolean" } },
    {
      type: "object",
      properties: {
        name: { type: "string" },
        metadata: {},
      },
      required: ["name"],
      additionalProperties: false,
    },
  ])("accepts supported schema $type", (schema) => {
    expect(ConstantValueSchemaV1Schema.safeParse(schema).success).toBe(true);
  });

  it.each([
    { type: "integer" },
    { type: "string", enum: [] },
    { type: "string", enum: ["a", "a"] },
    { type: "string", enum: ["a", 1] },
    { type: "array" },
    { type: "array", items: { type: "object" } },
    { type: "array", items: { type: "string", enum: ["a"] } },
    { type: "array", items: { type: "string" }, minItems: 1 },
    {
      type: "object",
      properties: { child: { type: "object" } },
    },
    {
      type: "object",
      properties: { name: {} },
      required: ["missing"],
    },
    {
      type: "object",
      properties: { name: {} },
      required: ["name", "name"],
    },
    {
      type: "object",
      properties: {},
      additionalProperties: { type: "string" },
    },
    { type: "string", oneOf: [{ type: "string" }] },
  ])("rejects unsupported schema %#", (schema) => {
    expect(ConstantValueSchemaV1Schema.safeParse(schema).success).toBe(false);
  });
});

describe("type definition schemas", () => {
  it("accepts schemas for local type definitions", () => {
    expect(
      TypeDefinitionV1Schema.safeParse({
        name: "Settings",
        schema: { type: "object", properties: {} },
      }).success
    ).toBe(true);
  });

  it.each([
    { name: "Settings" },
    { name: "Settings", alias: "PublicSettings" },
    { name: "Settings", from: "./settings" },
    { name: "Settings", alias: "PublicSettings", from: "./settings" },
    { name: "Settings", schema: { type: "object", properties: {} } },
    {
      name: "Settings",
      alias: "PublicSettings",
      schema: { type: "object", properties: {} },
    },
  ])("accepts exported type definition %#", (definition) => {
    expect(ExportTypeDefinitionV1Schema.safeParse(definition).success).toBe(
      true
    );
  });

  it("rejects an exported type definition with both from and schema", () => {
    expect(
      ExportTypeDefinitionV1Schema.safeParse({
        name: "Settings",
        alias: "PublicSettings",
        from: "./settings",
        schema: { type: "object", properties: {} },
      }).success
    ).toBe(false);
  });
});
