import { z } from "zod";
import {
  ConstantDefinitionV1Schema,
  ExportConstantDefinitionV1Schema,
  ExportTypeDefinitionV1Schema,
  TypeDefinitionV1Schema,
} from "./constant-schema.js";
import { compileImportSourceConstraints } from "./import-source-selector.js";

export const ExportDefinitionV1Schema = z.strictObject({
  alias: z.string().optional(),
  from: z.string().optional(),
  name: z.string(),
});

export const DeclarationDefinitionV1Schema = z.strictObject({
  name: z.string(),
});

export const ImportDefinitionV1Schema = z.strictObject({
  alias: z.string().optional(),
  from: z.string().optional(),
  name: z.string(),
});

const ImportConditionDefinitionV1Schema = ImportDefinitionV1Schema.omit({
  alias: true,
});

const ImportConditionEntryV1Schema = z.union([
  z.string(),
  ImportConditionDefinitionV1Schema,
]);

export const IfConditionV1Schema = z.union([
  z.strictObject({ hasFile: z.string() }),
  z.strictObject({ hasDirectory: z.string() }),
  z.strictObject({ placeholderSatisfies: z.string() }),
  z.strictObject({ hasValueImport: ImportConditionEntryV1Schema }),
  z.strictObject({ hasValueImportFrom: z.string() }),
  z.strictObject({ hasTypeImport: ImportConditionEntryV1Schema }),
  z.strictObject({ hasTypeImportFrom: z.string() }),
]);

const LegacyExportDefinitionV1Schema = z.strictObject({
  from: z.string().optional(),
  name: z.string(),
});

const LegacyImportDefinitionV1Schema = z.strictObject({
  from: z.string().optional(),
  name: z.string(),
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

export const CallFunctionDefinitionV1Schema = z.strictObject({
  arguments: z.array(z.string()).optional(),
  name: z.string(),
});

const ExtendDefinitionV1Schema = z.union([
  z.string(),
  z.strictObject({
    allowOmissions: z.boolean().optional(),
    type: z.string(),
  }),
]);

export const InterfaceDefinitionV1Schema = z.strictObject({
  extend: ExtendDefinitionV1Schema.optional(),
  name: z.string(),
});

export const ClassDefinitionV1Schema = z.strictObject({
  extend: ExtendDefinitionV1Schema.optional(),
  implement: z.array(ExtendDefinitionV1Schema).optional(),
  name: z.string(),
});

const ExportValuesPredicateV1Schema = z.array(
  z.union([z.string(), ExportDefinitionV1Schema])
);
const ImportValuesPredicateV1Schema = z.array(
  z.union([z.string(), ImportDefinitionV1Schema])
);
const LegacyExportPredicateV1Schema = z.array(
  z.union([z.string(), LegacyExportDefinitionV1Schema])
);
const LegacyImportPredicateV1Schema = z.array(
  z.union([z.string(), LegacyImportDefinitionV1Schema])
);
const ExactImportSourcePredicateV1Schema = z.union([
  z.string(),
  z.array(z.string()),
]);
function createSourceSelectorPredicateV1Schema(opts: {
  sourceLabel: "Import" | "Export";
}) {
  return ExactImportSourcePredicateV1Schema.superRefine((value, context) => {
    const result = compileImportSourceConstraints({
      expected: value,
      sourceLabel: opts.sourceLabel,
    });
    if (result.success) {
      return;
    }
    context.addIssue({
      code: "custom",
      message: result.error,
      path: result.index === undefined ? [] : [result.index],
    });
  });
}

const ImportSourceSelectorPredicateV1Schema =
  createSourceSelectorPredicateV1Schema({ sourceLabel: "Import" });
const ExportSourceSelectorPredicateV1Schema =
  createSourceSelectorPredicateV1Schema({ sourceLabel: "Export" });

export const MustPredicatesV1Schema = z.strictObject({
  areBarrelFiles: z.boolean().optional(),
  callFunction: z
    .array(z.union([z.string(), CallFunctionDefinitionV1Schema]))
    .optional(),
  declareClasses: z
    .array(z.union([z.string(), ClassDefinitionV1Schema]))
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
  declareTypes: z
    .array(z.union([z.string(), TypeDefinitionV1Schema]))
    .optional(),
  /**
   * @deprecated Use exportValues instead.
   */
  export: LegacyExportPredicateV1Schema.optional().meta({
    deprecated: true,
    description: "Use exportValues instead.",
  }),
  exportClasses: z
    .array(z.union([z.string(), ClassDefinitionV1Schema]))
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
  exportTypes: z
    .array(z.union([z.string(), ExportTypeDefinitionV1Schema]))
    .optional(),
  exportTypesFrom: ExportSourceSelectorPredicateV1Schema.optional(),
  exportTypesFromCurrentDir: z.boolean().optional(),
  exportTypesFromExternals: z.boolean().optional(),
  exportTypesFromParents: z.boolean().optional(),
  exportValues: ExportValuesPredicateV1Schema.optional(),
  exportValuesFrom: ExportSourceSelectorPredicateV1Schema.optional(),
  exportValuesFromCurrentDir: z.boolean().optional(),
  exportValuesFromExternals: z.boolean().optional(),
  exportValuesFromParents: z.boolean().optional(),
  haveDirectories: z.array(z.string()).optional(),
  haveFiles: z.array(z.string()).optional(),
  haveType: z.enum(["file", "directory"]).optional(),
  /**
   * @deprecated Use importValues instead.
   */
  import: LegacyImportPredicateV1Schema.optional().meta({
    deprecated: true,
    description: "Use importValues instead.",
  }),
  /**
   * @deprecated Use importValuesFrom or importTypesFrom instead.
   */
  importFrom: ExactImportSourcePredicateV1Schema.optional().meta({
    deprecated: true,
    description: "Use importValuesFrom or importTypesFrom instead.",
  }),
  /**
   * @deprecated Use importValuesFromCurrentDir instead.
   */
  importFromCurrentDir: z.boolean().optional().meta({
    deprecated: true,
    description: "Use importValuesFromCurrentDir instead.",
  }),
  /**
   * @deprecated Use importValuesFromExternals instead.
   */
  importFromExternals: z.boolean().optional().meta({
    deprecated: true,
    description: "Use importValuesFromExternals instead.",
  }),
  /**
   * @deprecated Use importValuesFromParents instead.
   */
  importFromParents: z.boolean().optional().meta({
    deprecated: true,
    description: "Use importValuesFromParents instead.",
  }),
  importTypes: z
    .array(z.union([z.string(), ImportDefinitionV1Schema]))
    .optional(),
  importTypesFrom: ImportSourceSelectorPredicateV1Schema.optional(),
  importTypesFromCurrentDir: z.boolean().optional(),
  importTypesFromExternals: z.boolean().optional(),
  importTypesFromParents: z.boolean().optional(),
  importValues: ImportValuesPredicateV1Schema.optional(),
  importValuesFrom: ImportSourceSelectorPredicateV1Schema.optional(),
  importValuesFromCurrentDir: z.boolean().optional(),
  importValuesFromExternals: z.boolean().optional(),
  importValuesFromParents: z.boolean().optional(),
  useDeclarationOrder: z.array(z.string()).optional(),
});

const MustBlockV1Shape = {
  description: z.string().optional(),
  excludeFiles: z.array(z.string()).optional(),
  for: z
    .strictObject({ files: z.union([z.string(), z.array(z.string())]) })
    .optional(),
  if: IfConditionV1Schema.optional(),
  ifNot: IfConditionV1Schema.optional(),
  name: z
    .string()
    .regex(/^[a-z0-9-]+$/, "Must block name must match [a-z0-9-]+")
    .optional(),
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
  description: z.string(),
  excludeFiles: z.array(z.string()).optional(),
  for: z
    .strictObject({ files: z.union([z.string(), z.array(z.string())]) })
    .optional(),
  if: IfConditionV1Schema.optional(),
  ifNot: IfConditionV1Schema.optional(),
  name: z
    .string()
    .regex(/^[a-z0-9-]+$/, "Convention name must match [a-z0-9-]+"),
  paths: z.union([z.string(), z.array(z.string())]).optional(),
  severity: z.enum(["error", "warning"]).optional(),
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
export type IfConditionV1 = z.infer<typeof IfConditionV1Schema>;
export type FunctionDefinitionV1 = z.infer<typeof FunctionDefinitionV1Schema>;
export type CallFunctionDefinitionV1 = z.infer<
  typeof CallFunctionDefinitionV1Schema
>;
export type InterfaceDefinitionV1 = z.infer<typeof InterfaceDefinitionV1Schema>;
export type ClassDefinitionV1 = z.infer<typeof ClassDefinitionV1Schema>;
export type MustPredicatesV1 = z.infer<typeof MustPredicatesV1Schema>;
export type MustBlockV1 = z.infer<typeof MustBlockV1Schema>;
export type ReusableConventionV1 = z.infer<typeof ReusableConventionV1Schema>;
export type ReusableConventionsPackageV1 = z.infer<
  typeof ReusableConventionsPackageV1Schema
>;
