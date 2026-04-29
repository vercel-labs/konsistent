import { z } from "zod";

export const ExportDefinitionV1Schema = z
  .object({
    name: z.string(),
    from: z.string().optional(),
  })
  .strict();

export const ImportDefinitionV1Schema = z
  .object({
    name: z.string(),
    from: z.string().optional(),
  })
  .strict();

export const FunctionDefinitionV1Schema = z
  .object({
    name: z.string(),
    receiveParamOfType: z.string().optional(),
    returnValueOfType: z.string().optional(),
  })
  .strict();

const ExtendDefinitionV1Schema = z.union([
  z.string(),
  z
    .object({
      type: z.string(),
      allowOmissions: z.boolean().optional(),
    })
    .strict(),
]);

export const InterfaceDefinitionV1Schema = z
  .object({
    name: z.string(),
    extend: ExtendDefinitionV1Schema.optional(),
  })
  .strict();

export const ClassDefinitionV1Schema = z
  .object({
    name: z.string(),
    extend: ExtendDefinitionV1Schema.optional(),
    implement: z.array(ExtendDefinitionV1Schema).optional(),
  })
  .strict();

export const MustPredicatesV1Schema = z
  .object({
    haveType: z.enum(["file", "directory"]).optional(),
    haveFiles: z.array(z.string()).optional(),
    export: z.array(z.union([z.string(), ExportDefinitionV1Schema])).optional(),
    exportTypes: z
      .array(z.union([z.string(), ExportDefinitionV1Schema]))
      .optional(),
    exportConstants: z
      .array(z.union([z.string(), ExportDefinitionV1Schema]))
      .optional(),
    exportFunctions: z
      .array(z.union([z.string(), FunctionDefinitionV1Schema]))
      .optional(),
    exportInterfaces: z
      .array(z.union([z.string(), InterfaceDefinitionV1Schema]))
      .optional(),
    exportClasses: z
      .array(z.union([z.string(), ClassDefinitionV1Schema]))
      .optional(),
    import: z.array(z.union([z.string(), ImportDefinitionV1Schema])).optional(),
    importTypes: z
      .array(z.union([z.string(), ImportDefinitionV1Schema]))
      .optional(),
  })
  .strict();

export const MustBlockV1Schema = z
  .object({
    name: z
      .string()
      .regex(/^[a-z0-9-]+$/, "Must block name must match [a-z0-9-]+")
      .optional(),
    description: z.string().optional(),
    if: z.object({ hasFile: z.string() }).strict().optional(),
    for: z
      .object({ files: z.union([z.string(), z.array(z.string())]) })
      .strict()
      .optional(),
    excludeFiles: z.array(z.string()).optional(),
    must: MustPredicatesV1Schema,
  })
  .strict();

export const ConventionV1Schema = z
  .object({
    name: z
      .string()
      .regex(/^[a-z0-9-]+$/, "Convention name must match [a-z0-9-]+")
      .optional(),
    description: z.string().optional(),
    severity: z.enum(["error", "warning"]).default("error").optional(),
    excludeFiles: z.array(z.string()).optional(),
    paths: z.union([z.string(), z.array(z.string())]),
    must: z.union([MustPredicatesV1Schema, z.array(MustBlockV1Schema)]),
  })
  .strict();

export const ConfigV1Schema = z
  .object({
    $schema: z.string().optional(),
    version: z.literal("v1"),
    kebabToPascalMap: z.record(z.string(), z.string()).optional(),
    kebabToCamelMap: z.record(z.string(), z.string()).optional(),
    conventions: z.array(ConventionV1Schema),
  })
  .strict();

export type ConfigV1 = z.infer<typeof ConfigV1Schema>;
export type ConventionV1 = z.infer<typeof ConventionV1Schema>;
export type MustPredicatesV1 = z.infer<typeof MustPredicatesV1Schema>;
export type MustBlockV1 = z.infer<typeof MustBlockV1Schema>;
