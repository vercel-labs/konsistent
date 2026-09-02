import { describe, expect, it } from "vitest";
import {
  ConstantDefinitionV1Schema,
  ConstantValueSchemaV1Schema,
  ExportConstantDefinitionV1Schema,
  ExportTypeDefinitionV1Schema,
  TypeDefinitionV1Schema,
} from "./constant-schema.js";

describe("ConstantValueSchemaV1Schema", () => {
  it.each([
    { type: "string" },
    { type: "number", enum: [1, 2] },
    { type: "array", items: { type: "boolean" } },
    { type: "array", items: "ReadonlyArray<MyType>" },
    { type: "array", items: "${name.toPascalCase()}Data" },
    {
      type: "object",
      properties: {
        name: { type: "string" },
        auth: "Readonly<MyAuth>",
        data: "${name.toPascalCase()}Data",
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
    { type: "array", items: { type: "string", enum: ["a"] } },
    { type: "array", items: { type: "string" }, minItems: 1 },
    { type: "array", items: "" },
    { type: "array", items: { type: "MyType" } },
    {
      type: "object",
      properties: { child: { type: "MyType" } },
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
    { type: "MyType" },
  ])("rejects unsupported schema %#", (schema) => {
    expect(ConstantValueSchemaV1Schema.safeParse(schema).success).toBe(false);
  });
});

describe("type definition schemas", () => {
  it.each([
    ConstantDefinitionV1Schema,
    TypeDefinitionV1Schema,
  ])("accepts unconstrained, schema, or type-constrained local definitions", (definitionSchema) => {
    for (const definition of [
      { name: "Settings" },
      {
        name: "Settings",
        schema: { type: "object", properties: {} },
      },
      { name: "Settings", type: "SharedSettings<'generic-value'>" },
    ]) {
      expect(definitionSchema.safeParse(definition).success).toBe(true);
    }
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
    { name: "Settings", type: "SharedSettings<'generic-value'>" },
    {
      name: "Settings",
      alias: "PublicSettings",
      type: "SharedSettings<'generic-value'>",
    },
  ])("accepts exported type definition %#", (definition) => {
    expect(ExportTypeDefinitionV1Schema.safeParse(definition).success).toBe(
      true
    );
  });

  it.each([
    {
      name: "Settings",
      schema: { type: "object", properties: {} },
      type: "SharedSettings",
    },
    {
      name: "Settings",
      from: "./settings",
      schema: { type: "object", properties: {} },
    },
    {
      name: "Settings",
      from: "./settings",
      type: "SharedSettings",
    },
    { name: "Settings", type: "" },
  ])("rejects invalid exported type definition %#", (definition) => {
    expect(ExportTypeDefinitionV1Schema.safeParse(definition).success).toBe(
      false
    );
  });
});

describe("exported constant definition schemas", () => {
  it.each([
    { name: "settings" },
    { name: "settings", schema: { type: "object", properties: {} } },
    { name: "settings", type: "SharedSettings<'generic-value'>" },
  ])("accepts exported constant definition %#", (definition) => {
    expect(ExportConstantDefinitionV1Schema.safeParse(definition).success).toBe(
      true
    );
  });

  it.each([
    {
      name: "settings",
      schema: { type: "object", properties: {} },
      type: "SharedSettings",
    },
    { name: "settings", type: "" },
    { name: "settings", from: "./settings" },
  ])("rejects invalid exported constant definition %#", (definition) => {
    expect(ExportConstantDefinitionV1Schema.safeParse(definition).success).toBe(
      false
    );
  });
});
