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
    { enum: [1, 2], type: "number" },
    { items: { type: "boolean" }, type: "array" },
    { items: "ReadonlyArray<MyType>", type: "array" },
    { items: "${name.toPascalCase()}Data", type: "array" },
    {
      additionalProperties: false,
      properties: {
        auth: "Readonly<MyAuth>",
        data: "${name.toPascalCase()}Data",
        metadata: {},
        name: { type: "string" },
      },
      required: ["name"],
      type: "object",
    },
  ])("accepts supported schema $type", (schema) => {
    expect(ConstantValueSchemaV1Schema.safeParse(schema).success).toBe(true);
  });

  it.each([
    { type: "integer" },
    { enum: [], type: "string" },
    { enum: ["a", "a"], type: "string" },
    { enum: ["a", 1], type: "string" },
    { type: "array" },
    { items: { enum: ["a"], type: "string" }, type: "array" },
    { items: { type: "string" }, minItems: 1, type: "array" },
    { items: "", type: "array" },
    { items: { type: "MyType" }, type: "array" },
    {
      properties: { child: { type: "MyType" } },
      type: "object",
    },
    {
      properties: { name: {} },
      required: ["missing"],
      type: "object",
    },
    {
      properties: { name: {} },
      required: ["name", "name"],
      type: "object",
    },
    {
      additionalProperties: { type: "string" },
      properties: {},
      type: "object",
    },
    { oneOf: [{ type: "string" }], type: "string" },
    { type: "MyType" },
  ])("rejects unsupported schema %#", (schema) => {
    expect(ConstantValueSchemaV1Schema.safeParse(schema).success).toBe(false);
  });
});

describe("type definition schemas", () => {
  it.each([ConstantDefinitionV1Schema, TypeDefinitionV1Schema])(
    "accepts unconstrained, schema, or type-constrained local definitions",
    (definitionSchema) => {
      for (const definition of [
        { name: "Settings" },
        {
          name: "Settings",
          schema: { properties: {}, type: "object" },
        },
        { name: "Settings", type: "SharedSettings<'generic-value'>" },
      ]) {
        expect(definitionSchema.safeParse(definition).success).toBe(true);
      }
    }
  );

  it.each([
    { name: "Settings" },
    { alias: "PublicSettings", name: "Settings" },
    { from: "./settings", name: "Settings" },
    { alias: "PublicSettings", from: "./settings", name: "Settings" },
    { name: "Settings", schema: { properties: {}, type: "object" } },
    {
      alias: "PublicSettings",
      name: "Settings",
      schema: { properties: {}, type: "object" },
    },
    { name: "Settings", type: "SharedSettings<'generic-value'>" },
    {
      alias: "PublicSettings",
      name: "Settings",
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
      schema: { properties: {}, type: "object" },
      type: "SharedSettings",
    },
    {
      from: "./settings",
      name: "Settings",
      schema: { properties: {}, type: "object" },
    },
    {
      from: "./settings",
      name: "Settings",
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
    { name: "settings", schema: { properties: {}, type: "object" } },
    { name: "settings", type: "SharedSettings<'generic-value'>" },
  ])("accepts exported constant definition %#", (definition) => {
    expect(ExportConstantDefinitionV1Schema.safeParse(definition).success).toBe(
      true
    );
  });

  it.each([
    {
      name: "settings",
      schema: { properties: {}, type: "object" },
      type: "SharedSettings",
    },
    { name: "settings", type: "" },
    { from: "./settings", name: "settings" },
  ])("rejects invalid exported constant definition %#", (definition) => {
    expect(ExportConstantDefinitionV1Schema.safeParse(definition).success).toBe(
      false
    );
  });
});
