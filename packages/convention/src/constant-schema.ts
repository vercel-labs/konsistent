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
    enum: z.array(ConstantScalarValueV1Schema).min(1),
    type: ConstantScalarTypeV1Schema,
  })
  .superRefine((schema, context) => {
    const seen = new Set<string>();

    for (const [index, value] of schema.enum.entries()) {
      const valueType = value === null ? "null" : typeof value;
      if (valueType !== schema.type) {
        context.addIssue({
          code: "custom",
          message: `Enum value must be of type "${schema.type}"`,
          path: ["enum", index],
        });
      }

      const key = `${valueType}:${String(value)}`;
      if (seen.has(key)) {
        context.addIssue({
          code: "custom",
          message: "Enum values must be unique",
          path: ["enum", index],
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
  items: InnerTypeConstraintV1Schema,
  type: z.literal("array"),
});

export const ConstantObjectSchemaV1Schema = z
  .strictObject({
    additionalProperties: z.boolean().optional(),
    properties: z.record(z.string(), ConstantObjectPropertySchemaV1Schema),
    required: z.array(z.string()).optional(),
    type: z.literal("object"),
  })
  .superRefine((schema, context) => {
    const seen = new Set<string>();

    for (const [index, name] of (schema.required ?? []).entries()) {
      if (seen.has(name)) {
        context.addIssue({
          code: "custom",
          message: "Required property names must be unique",
          path: ["required", index],
        });
      }
      seen.add(name);

      if (!Object.hasOwn(schema.properties, name)) {
        context.addIssue({
          code: "custom",
          message: `Required property "${name}" must be defined in properties`,
          path: ["required", index],
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

const TypeExpressionV1Schema = z.string().min(1);

export const ConstantDefinitionV1Schema = z.union([
  z.strictObject({
    name: z.string(),
  }),
  z.strictObject({
    name: z.string(),
    schema: ConstantValueSchemaV1Schema,
  }),
  z.strictObject({
    name: z.string(),
    type: TypeExpressionV1Schema,
  }),
]);

export const ExportConstantDefinitionV1Schema = ConstantDefinitionV1Schema;

export const TypeDefinitionV1Schema = ConstantDefinitionV1Schema;

export const ExportTypeDefinitionV1Schema = z.union([
  z.strictObject({
    alias: z.string().optional(),
    name: z.string(),
  }),
  z.strictObject({
    alias: z.string().optional(),
    name: z.string(),
    schema: ConstantValueSchemaV1Schema,
  }),
  z.strictObject({
    alias: z.string().optional(),
    name: z.string(),
    type: TypeExpressionV1Schema,
  }),
  z.strictObject({
    alias: z.string().optional(),
    from: z.string(),
    name: z.string(),
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
