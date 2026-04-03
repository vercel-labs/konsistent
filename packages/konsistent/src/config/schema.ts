import { z } from 'zod';

export const ExportDefinitionV1Schema = z.object({
  name: z.string(),
});

export const ImportDefinitionV1Schema = z.object({
  name: z.string(),
  from: z.string().optional(),
});

export const FunctionDefinitionV1Schema = z.object({
  name: z.string(),
  receiveParamOfType: z.string().optional(),
  returnValueOfType: z.string().optional(),
});

export const InterfaceDefinitionV1Schema = z.object({
  name: z.string(),
  extend: z.string().optional(),
});

export const ClassDefinitionV1Schema = z.object({
  name: z.string(),
  extend: z.string().optional(),
});

export const MustPredicatesV1Schema = z
  .object({
    haveType: z.enum(['file', 'directory']).optional(),
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
  .passthrough();

export const MustBlockV1Schema = z.object({
  if: z.object({ hasFile: z.string() }).optional(),
  for: z.object({ files: z.string() }).optional(),
  must: MustPredicatesV1Schema,
});

export const ConventionV1Schema = z.object({
  name: z
    .string()
    .regex(/^[a-z0-9-]+$/, 'Convention name must match [a-z0-9-]+')
    .optional(),
  description: z.string().optional(),
  severity: z.enum(['error', 'warning']).default('error').optional(),
  paths: z.union([z.string(), z.array(z.string())]),
  must: z.union([MustPredicatesV1Schema, z.array(MustBlockV1Schema)]),
});

export const ConfigV1Schema = z.object({
  $schema: z.string().optional(),
  version: z.literal('v1'),
  conventions: z.array(ConventionV1Schema),
});

export type ConfigV1 = z.infer<typeof ConfigV1Schema>;
export type ConventionV1 = z.infer<typeof ConventionV1Schema>;
export type MustPredicatesV1 = z.infer<typeof MustPredicatesV1Schema>;
export type MustBlockV1 = z.infer<typeof MustBlockV1Schema>;
