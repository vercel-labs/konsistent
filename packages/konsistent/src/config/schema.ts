import {
  MustBlockV1Schema,
  MustPredicatesV1Schema,
} from "@konsistent/convention";
import { z } from "zod";

export type {
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
  FunctionDefinitionV1,
  ImportDefinitionV1,
  InterfaceDefinitionV1,
  MustBlockV1,
  MustPredicatesV1,
  ReusableConventionsPackageV1,
  ReusableConventionV1,
} from "@konsistent/convention";
export {
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
  FunctionDefinitionV1Schema,
  ImportDefinitionV1Schema,
  InterfaceDefinitionV1Schema,
  MustBlockV1Schema,
  MustPredicatesV1Schema,
  ReusableConventionsPackageV1Schema,
  ReusableConventionV1Schema,
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

const ConditionSchema = z.union([
  z.strictObject({ hasFile: z.string() }),
  z.strictObject({ placeholderSatisfies: z.string() }),
]);

const ForSchema = z.strictObject({
  files: z.union([z.string(), z.array(z.string())]),
});

const ConventionMustSchema = z.union([
  MustPredicatesV1Schema,
  z.array(MustBlockV1Schema),
]);

const ConventionV1Shape = {
  name: z
    .string()
    .regex(/^[a-z0-9-]+$/, "Convention name must match [a-z0-9-]+")
    .optional(),
  description: z.string().optional(),
  severity: z.enum(["error", "warning"]).default("error").optional(),
  excludeFiles: z.array(z.string()).optional(),
  paths: z.union([z.string(), z.array(z.string())]),
  placeholders: PlaceholdersMapSchema.optional(),
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
  use: z
    .string()
    .regex(
      /^[a-z0-9-]+\/[a-z0-9-]+$/,
      'Must block "use" must match "<vendor>/<name>"'
    ),
  name: z
    .string()
    .regex(/^[a-z0-9-]+$/, "Must block name must match [a-z0-9-]+")
    .optional(),
  description: z.string().optional(),
  if: ConditionSchema.optional(),
  for: ForSchema.optional(),
  excludeFiles: z.array(z.string()).optional(),
  must: MustPredicatesV1Schema.optional(),
  mustNot: MustPredicatesV1Schema.optional(),
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
  name: z
    .string()
    .regex(/^[a-z0-9-]+$/, "Convention name must match [a-z0-9-]+")
    .optional(),
  description: z.string().optional(),
  severity: z.enum(["error", "warning"]).default("error").optional(),
  excludeFiles: z.array(z.string()).optional(),
  paths: z.union([z.string(), z.array(z.string())]),
  placeholders: PlaceholdersMapSchema.optional(),
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
  use: z
    .string()
    .regex(
      /^[a-z0-9-]+\/[a-z0-9-]+$/,
      'Convention reference "use" must match "<vendor>/<name>"'
    ),
  severity: z.enum(["error", "warning"]).optional(),
  paths: z.union([z.string(), z.array(z.string())]).optional(),
  placeholders: PlaceholdersMapSchema.optional(),
  excludeFiles: z.array(z.string()).optional(),
  if: ConditionSchema.optional(),
  for: ForSchema.optional(),
  must: MustPredicatesV1Schema.optional(),
  mustNot: MustPredicatesV1Schema.optional(),
});

export const ConfigV1Schema = z.strictObject({
  $schema: z.string().optional(),
  version: z.literal("v1"),
  kebabToPascalMap: z.record(z.string(), z.string()).optional(),
  kebabToCamelMap: z.record(z.string(), z.string()).optional(),
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
