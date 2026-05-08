import {
  MustBlockV1Schema,
  MustPredicatesV1Schema,
} from "@konsistent/convention";
import { z } from "zod";

export type {
  ClassDefinitionV1,
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

export const ConventionV1Schema = z.strictObject({
  name: z
    .string()
    .regex(/^[a-z0-9-]+$/, "Convention name must match [a-z0-9-]+")
    .optional(),
  description: z.string().optional(),
  severity: z.enum(["error", "warning"]).default("error").optional(),
  excludeFiles: z.array(z.string()).optional(),
  paths: z.union([z.string(), z.array(z.string())]),
  placeholders: PlaceholdersMapSchema.optional(),
  must: z.union([MustPredicatesV1Schema, z.array(MustBlockV1Schema)]),
});

export const MustBlockUseRefSchema = MustBlockV1Schema.partial().extend({
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

const RawHandWrittenConventionV1Schema = z.strictObject({
  name: z
    .string()
    .regex(/^[a-z0-9-]+$/, "Convention name must match [a-z0-9-]+")
    .optional(),
  description: z.string().optional(),
  severity: z.enum(["error", "warning"]).default("error").optional(),
  excludeFiles: z.array(z.string()).optional(),
  paths: z.union([z.string(), z.array(z.string())]),
  placeholders: PlaceholdersMapSchema.optional(),
  must: z.union([
    MustPredicatesV1Schema,
    z.array(
      z.union([
        ConventionStringRefSchema,
        MustBlockV1Schema,
        MustBlockUseRefSchema,
      ])
    ),
  ]),
});

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
  if: z
    .union([
      z.strictObject({ hasFile: z.string() }),
      z.strictObject({ placeholderSatisfies: z.string() }),
    ])
    .optional(),
  for: z
    .strictObject({ files: z.union([z.string(), z.array(z.string())]) })
    .optional(),
  must: MustPredicatesV1Schema.optional(),
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
