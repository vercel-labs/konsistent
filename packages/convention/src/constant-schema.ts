import { z } from "zod";

export const ConstantScalarTypeV1Schema = z.enum([
  "string",
  "number",
  "boolean",
  "null",
]);

const ConstantScalarValueV1Schema = z.union([
  z.string(),
  z.number(),
  z.boolean(),
  z.null(),
]);

export const ConstantScalarSchemaV1Schema = z.strictObject({
  type: ConstantScalarTypeV1Schema,
});

export const InnerTypeConstraintV1Schema = z.union([
  ConstantScalarSchemaV1Schema,
  z.string().min(1),
]);

export const ConstantEnumSchemaV1Schema = z
  .strictObject({
    type: ConstantScalarTypeV1Schema,
    enum: z.array(ConstantScalarValueV1Schema).min(1),
  })
  .superRefine((schema, context) => {
    const seen = new Set<string>();

    for (const [index, value] of schema.enum.entries()) {
      const valueType = value === null ? "null" : typeof value;
      if (valueType !== schema.type) {
        context.addIssue({
          code: "custom",
          path: ["enum", index],
          message: `Enum value must be of type "${schema.type}"`,
        });
      }

      const key = `${valueType}:${String(value)}`;
      if (seen.has(key)) {
        context.addIssue({
          code: "custom",
          path: ["enum", index],
          message: "Enum values must be unique",
        });
      }
      seen.add(key);
    }
  });

const ConstantObjectPropertySchemaV1Schema = z.union([
  z.strictObject({}),
  InnerTypeConstraintV1Schema,
]);

export const ConstantArraySchemaV1Schema = z.strictObject({
  type: z.literal("array"),
  items: InnerTypeConstraintV1Schema,
});

export const ConstantObjectSchemaV1Schema = z
  .strictObject({
    type: z.literal("object"),
    properties: z.record(z.string(), ConstantObjectPropertySchemaV1Schema),
    required: z.array(z.string()).optional(),
    additionalProperties: z.boolean().optional(),
  })
  .superRefine((schema, context) => {
    const seen = new Set<string>();

    for (const [index, name] of (schema.required ?? []).entries()) {
      if (seen.has(name)) {
        context.addIssue({
          code: "custom",
          path: ["required", index],
          message: "Required property names must be unique",
        });
      }
      seen.add(name);

      if (!Object.hasOwn(schema.properties, name)) {
        context.addIssue({
          code: "custom",
          path: ["required", index],
          message: `Required property "${name}" must be defined in properties`,
        });
      }
    }
  });

export const ConstantValueSchemaV1Schema = z.union([
  ConstantEnumSchemaV1Schema,
  ConstantArraySchemaV1Schema,
  ConstantObjectSchemaV1Schema,
  ConstantScalarSchemaV1Schema,
]);

export const ConstantDefinitionV1Schema = z.strictObject({
  name: z.string(),
  schema: ConstantValueSchemaV1Schema.optional(),
});

export const ExportConstantDefinitionV1Schema = z.strictObject({
  name: z.string(),
  from: z.string().optional(),
  schema: ConstantValueSchemaV1Schema.optional(),
});

export const TypeDefinitionV1Schema = z.strictObject({
  name: z.string(),
  schema: ConstantValueSchemaV1Schema.optional(),
});

export const ExportTypeDefinitionV1Schema = z.union([
  z.strictObject({
    alias: z.string().optional(),
    name: z.string(),
    schema: ConstantValueSchemaV1Schema.optional(),
  }),
  z.strictObject({
    alias: z.string().optional(),
    name: z.string(),
    from: z.string(),
  }),
]);

export type ConstantScalarTypeV1 = z.infer<typeof ConstantScalarTypeV1Schema>;
export type ConstantScalarSchemaV1 = z.infer<
  typeof ConstantScalarSchemaV1Schema
>;
export type InnerTypeConstraintV1 = z.infer<typeof InnerTypeConstraintV1Schema>;
export type ConstantEnumSchemaV1 = z.infer<typeof ConstantEnumSchemaV1Schema>;
export type ConstantArraySchemaV1 = z.infer<typeof ConstantArraySchemaV1Schema>;
export type ConstantObjectSchemaV1 = z.infer<
  typeof ConstantObjectSchemaV1Schema
>;
export type ConstantValueSchemaV1 = z.infer<typeof ConstantValueSchemaV1Schema>;
export type ConstantDefinitionV1 = z.infer<typeof ConstantDefinitionV1Schema>;
export type ExportConstantDefinitionV1 = z.infer<
  typeof ExportConstantDefinitionV1Schema
>;
export type TypeDefinitionV1 = z.infer<typeof TypeDefinitionV1Schema>;
export type ExportTypeDefinitionV1 = z.infer<
  typeof ExportTypeDefinitionV1Schema
>;
