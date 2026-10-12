import {
  IfConditionV1Schema,
  MustBlockV1Schema,
  MustPredicatesV1Schema,
} from "@konsistent/convention";
import { z } from "zod";

export type {
  CallFunctionDefinitionV1,
  ClassDefinitionV1,
  ConstantArraySchemaV1,
  ConstantDefinitionV1,
  ConstantEnumSchemaV1,
  ConstantObjectSchemaV1,
  ConstantScalarSchemaV1,
  ConstantScalarTypeV1,
  ConstantValueSchemaV1,
  DeclarationDefinitionV1,
  ExportConstantDefinitionV1,
  ExportDefinitionV1,
  ExportTypeDefinitionV1,
  FunctionDefinitionV1,
  IfConditionV1,
  ImportDefinitionV1,
  InnerTypeConstraintV1,
  InterfaceDefinitionV1,
  MustBlockV1,
  MustPredicatesV1,
  ReusableConventionsPackageV1,
  ReusableConventionV1,
  TypeDefinitionV1,
} from "@konsistent/convention";
export {
  CallFunctionDefinitionV1Schema,
  ClassDefinitionV1Schema,
  ConstantArraySchemaV1Schema,
  ConstantDefinitionV1Schema,
  ConstantEnumSchemaV1Schema,
  ConstantObjectSchemaV1Schema,
  ConstantScalarSchemaV1Schema,
  ConstantScalarTypeV1Schema,
  ConstantValueSchemaV1Schema,
  DeclarationDefinitionV1Schema,
  ExportConstantDefinitionV1Schema,
  ExportDefinitionV1Schema,
  ExportTypeDefinitionV1Schema,
  FunctionDefinitionV1Schema,
  IfConditionV1Schema,
  ImportDefinitionV1Schema,
  InnerTypeConstraintV1Schema,
  InterfaceDefinitionV1Schema,
  MustBlockV1Schema,
  MustPredicatesV1Schema,
  ReusableConventionsPackageV1Schema,
  ReusableConventionV1Schema,
  TypeDefinitionV1Schema,
} from "@konsistent/convention";

const PlaceholdersMapSchema = z.record(
  z
    .string()
    .regex(
      /^[a-zA-Z][a-zA-Z0-9]*$/,
      "Placeholder name must match [a-zA-Z][a-zA-Z0-9]*"
    ),
  z
    .string()
    .regex(/^[a-zA-Z0-9_-]+$/, "Placeholder value must match [a-zA-Z0-9_-]+")
);

const ForSchema = z.strictObject({
  files: z.union([z.string(), z.array(z.string())]),
});

const ConventionMustSchema = z.union([
  MustPredicatesV1Schema,
  z.array(MustBlockV1Schema),
]);

const ConventionV1Shape = {
  description: z.string().optional(),
  excludeFiles: z.array(z.string()).optional(),
  if: IfConditionV1Schema.optional(),
  ifNot: IfConditionV1Schema.optional(),
  name: z
    .string()
    .regex(/^[a-z0-9-]+$/, "Convention name must match [a-z0-9-]+")
    .optional(),
  paths: z.union([z.string(), z.array(z.string())]),
  placeholders: PlaceholdersMapSchema.optional(),
  severity: z.enum(["error", "warning"]).default("error").optional(),
};

export const ConventionV1Schema = z.union([
  z.strictObject({
    ...ConventionV1Shape,
    must: ConventionMustSchema,
    mustNot: MustPredicatesV1Schema.optional(),
  }),
  z.strictObject({
    ...ConventionV1Shape,
    must: ConventionMustSchema.optional(),
    mustNot: MustPredicatesV1Schema,
  }),
]);

export const MustBlockUseRefSchema = z.strictObject({
  description: z.string().optional(),
  excludeFiles: z.array(z.string()).optional(),
  for: ForSchema.optional(),
  if: IfConditionV1Schema.optional(),
  ifNot: IfConditionV1Schema.optional(),
  must: MustPredicatesV1Schema.optional(),
  mustNot: MustPredicatesV1Schema.optional(),
  name: z
    .string()
    .regex(/^[a-z0-9-]+$/, "Must block name must match [a-z0-9-]+")
    .optional(),
  use: z
    .string()
    .regex(
      /^[a-z0-9-]+\/[a-z0-9-]+$/,
      'Must block "use" must match "<vendor>/<name>"'
    ),
});

const ConventionStringRefSchema = z
  .string()
  .regex(
    /^[a-z0-9-]+\/[a-z0-9-]+$/,
    'Convention reference must match "<vendor>/<name>"'
  );

const RawMustSchema = z.union([
  MustPredicatesV1Schema,
  z.array(
    z.union([
      ConventionStringRefSchema,
      MustBlockV1Schema,
      MustBlockUseRefSchema,
    ])
  ),
]);

const RawHandWrittenConventionV1Shape = {
  description: z.string().optional(),
  excludeFiles: z.array(z.string()).optional(),
  name: z
    .string()
    .regex(/^[a-z0-9-]+$/, "Convention name must match [a-z0-9-]+")
    .optional(),
  paths: z.union([z.string(), z.array(z.string())]),
  placeholders: PlaceholdersMapSchema.optional(),
  severity: z.enum(["error", "warning"]).default("error").optional(),
};

const RawHandWrittenConventionV1Schema = z.union([
  z.strictObject({
    ...RawHandWrittenConventionV1Shape,
    must: RawMustSchema,
    mustNot: MustPredicatesV1Schema.optional(),
  }),
  z.strictObject({
    ...RawHandWrittenConventionV1Shape,
    must: RawMustSchema.optional(),
    mustNot: MustPredicatesV1Schema,
  }),
]);

export const ConventionUseRefSchema = z.strictObject({
  excludeFiles: z.array(z.string()).optional(),
  for: ForSchema.optional(),
  if: IfConditionV1Schema.optional(),
  ifNot: IfConditionV1Schema.optional(),
  must: MustPredicatesV1Schema.optional(),
  mustNot: MustPredicatesV1Schema.optional(),
  paths: z.union([z.string(), z.array(z.string())]).optional(),
  placeholders: PlaceholdersMapSchema.optional(),
  severity: z.enum(["error", "warning"]).optional(),
  use: z
    .string()
    .regex(
      /^[a-z0-9-]+\/[a-z0-9-]+$/,
      'Convention reference "use" must match "<vendor>/<name>"'
    ),
});

export const ConfigV1Schema = z.strictObject({
  $schema: z.string().optional(),
  conventionSources: z
    .record(
      z.string().regex(/^[a-z0-9-]+$/, "Source prefix must match [a-z0-9-]+"),
      z.string()
    )
    .optional(),
  conventions: z.array(
    z.union([
      ConventionStringRefSchema,
      ConventionUseRefSchema,
      RawHandWrittenConventionV1Schema,
    ])
  ),
  kebabToCamelMap: z.record(z.string(), z.string()).optional(),
  kebabToPascalMap: z.record(z.string(), z.string()).optional(),
  version: z.literal("v1"),
});

export type MustBlockUseRefV1 = z.infer<typeof MustBlockUseRefSchema>;
export type RawConfigV1 = z.infer<typeof ConfigV1Schema>;
export type ConventionV1 = z.infer<typeof ConventionV1Schema>;
export type ConfigV1 = Omit<
  RawConfigV1,
  "conventions" | "conventionSources"
> & {
  conventions: ConventionV1[];
  conventionSources?: Record<string, string>;
};
