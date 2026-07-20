import { z } from "zod";
import {
  ConstantDefinitionV1Schema,
  ExportConstantDefinitionV1Schema,
  ExportTypeDefinitionV1Schema,
  TypeDefinitionV1Schema,
} from "./constant-schema.js";

export const ExportDefinitionV1Schema = z.strictObject({
  name: z.string(),
  from: z.string().optional(),
});

export const DeclarationDefinitionV1Schema = z.strictObject({
  name: z.string(),
});

export const ImportDefinitionV1Schema = z.strictObject({
  name: z.string(),
  from: z.string().optional(),
});

export const FunctionDefinitionV1Schema = z.strictObject({
  name: z.string(),
  /**
   * Deprecated: use receiveParamsOfTypes instead.
   */
  receiveParamOfType: z.string().optional(),
  receiveParamsOfTypes: z.array(z.string()).optional(),
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
  declareTypes: z
    .array(z.union([z.string(), TypeDefinitionV1Schema]))
    .optional(),
  declareConstants: z
    .array(z.union([z.string(), ConstantDefinitionV1Schema]))
    .optional(),
  declareFunctions: z
    .array(z.union([z.string(), FunctionDefinitionV1Schema]))
    .optional(),
  declareInterfaces: z
    .array(z.union([z.string(), InterfaceDefinitionV1Schema]))
    .optional(),
  declareClasses: z
    .array(z.union([z.string(), ClassDefinitionV1Schema]))
    .optional(),
  export: z.array(z.union([z.string(), ExportDefinitionV1Schema])).optional(),
  exportTypes: z
    .array(z.union([z.string(), ExportTypeDefinitionV1Schema]))
    .optional(),
  exportConstants: z
    .array(z.union([z.string(), ExportConstantDefinitionV1Schema]))
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
  importFrom: z.union([z.string(), z.array(z.string())]).optional(),
  importTypes: z
    .array(z.union([z.string(), ImportDefinitionV1Schema]))
    .optional(),
  importFromCurrentDir: z.boolean().optional(),
  importFromParents: z.boolean().optional(),
  importFromExternals: z.boolean().optional(),
  importTypesFromCurrentDir: z.boolean().optional(),
  importTypesFromParents: z.boolean().optional(),
  importTypesFromExternals: z.boolean().optional(),
  useDeclarationOrder: z.array(z.string()).optional(),
  areBarrelFiles: z.boolean().optional(),
});

const MustBlockV1Shape = {
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
};

export const MustBlockV1Schema = z.union([
  z.strictObject({
    ...MustBlockV1Shape,
    must: MustPredicatesV1Schema,
    mustNot: MustPredicatesV1Schema.optional(),
  }),
  z.strictObject({
    ...MustBlockV1Shape,
    must: MustPredicatesV1Schema.optional(),
    mustNot: MustPredicatesV1Schema,
  }),
]);

const ReusableConventionV1Shape = {
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
};

export const ReusableConventionV1Schema = z.union([
  z.strictObject({
    ...ReusableConventionV1Shape,
    must: MustPredicatesV1Schema,
    mustNot: MustPredicatesV1Schema.optional(),
  }),
  z.strictObject({
    ...ReusableConventionV1Shape,
    must: MustPredicatesV1Schema.optional(),
    mustNot: MustPredicatesV1Schema,
  }),
]);

export const ReusableConventionsPackageV1Schema = z.strictObject({
  conventionSpecVersion: z.literal("v1"),
  conventions: z.array(ReusableConventionV1Schema),
});

export type ExportDefinitionV1 = z.infer<typeof ExportDefinitionV1Schema>;
export type DeclarationDefinitionV1 = z.infer<
  typeof DeclarationDefinitionV1Schema
>;
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
