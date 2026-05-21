import { z } from "zod";

export const ExportDefinitionV1Schema = z.strictObject({
  name: z.string(),
  from: z.string().optional(),
});

export const ImportDefinitionV1Schema = z.strictObject({
  name: z.string(),
  from: z.string().optional(),
});

export const FunctionDefinitionV1Schema = z.strictObject({
  name: z.string(),
  receiveParamOfType: z.string().optional(),
  returnValueOfType: z.string().optional(),
});

const ExtendDefinitionV1Schema = z.union([
  z.string(),
  z.strictObject({
    type: z.string(),
    allowOmissions: z.boolean().optional(),
  }),
]);

export const InterfaceDefinitionV1Schema = z.strictObject({
  name: z.string(),
  extend: ExtendDefinitionV1Schema.optional(),
});

export const ClassDefinitionV1Schema = z.strictObject({
  name: z.string(),
  extend: ExtendDefinitionV1Schema.optional(),
  implement: z.array(ExtendDefinitionV1Schema).optional(),
});

export const MustPredicatesV1Schema = z.strictObject({
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
  areBarrelFiles: z.boolean().optional(),
});

export const MustBlockV1Schema = z.strictObject({
  name: z
    .string()
    .regex(/^[a-z0-9-]+$/, "Must block name must match [a-z0-9-]+")
    .optional(),
  description: z.string().optional(),
  if: z
    .union([
      z.strictObject({ hasFile: z.string() }),
      z.strictObject({ placeholderSatisfies: z.string() }),
    ])
    .optional(),
  for: z
    .strictObject({ files: z.union([z.string(), z.array(z.string())]) })
    .optional(),
  excludeFiles: z.array(z.string()).optional(),
  must: MustPredicatesV1Schema,
});

export const ReusableConventionV1Schema = z.strictObject({
  name: z
    .string()
    .regex(/^[a-z0-9-]+$/, "Convention name must match [a-z0-9-]+"),
  description: z.string(),
  severity: z.enum(["error", "warning"]).optional(),
  paths: z.union([z.string(), z.array(z.string())]).optional(),
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
  must: MustPredicatesV1Schema,
});

export const ReusableConventionsPackageV1Schema = z.strictObject({
  conventionSpecVersion: z.literal("v1"),
  conventions: z.array(ReusableConventionV1Schema),
});

export type ExportDefinitionV1 = z.infer<typeof ExportDefinitionV1Schema>;
export type ImportDefinitionV1 = z.infer<typeof ImportDefinitionV1Schema>;
export type FunctionDefinitionV1 = z.infer<typeof FunctionDefinitionV1Schema>;
export type InterfaceDefinitionV1 = z.infer<typeof InterfaceDefinitionV1Schema>;
export type ClassDefinitionV1 = z.infer<typeof ClassDefinitionV1Schema>;
export type MustPredicatesV1 = z.infer<typeof MustPredicatesV1Schema>;
export type MustBlockV1 = z.infer<typeof MustBlockV1Schema>;
export type ReusableConventionV1 = z.infer<typeof ReusableConventionV1Schema>;
export type ReusableConventionsPackageV1 = z.infer<
  typeof ReusableConventionsPackageV1Schema
>;
