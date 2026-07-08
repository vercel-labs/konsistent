import type { ReusableConventionV1 } from "./schemas.js";

export type {
  ConstantArraySchemaV1,
  ConstantDefinitionV1,
  ConstantEnumSchemaV1,
  ConstantObjectSchemaV1,
  ConstantScalarSchemaV1,
  ConstantScalarTypeV1,
  ConstantValueSchemaV1,
  ExportConstantDefinitionV1,
} from "./constant-schema.js";
export {
  ConstantArraySchemaV1Schema,
  ConstantDefinitionV1Schema,
  ConstantEnumSchemaV1Schema,
  ConstantObjectSchemaV1Schema,
  ConstantScalarSchemaV1Schema,
  ConstantScalarTypeV1Schema,
  ConstantValueSchemaV1Schema,
  ExportConstantDefinitionV1Schema,
} from "./constant-schema.js";
export type {
  ClassDefinitionV1,
  DeclarationDefinitionV1,
  ExportDefinitionV1,
  FunctionDefinitionV1,
  ImportDefinitionV1,
  InterfaceDefinitionV1,
  MustBlockV1,
  MustPredicatesV1,
  ReusableConventionsPackageV1,
  ReusableConventionV1,
} from "./schemas.js";
export {
  ClassDefinitionV1Schema,
  DeclarationDefinitionV1Schema,
  ExportDefinitionV1Schema,
  FunctionDefinitionV1Schema,
  ImportDefinitionV1Schema,
  InterfaceDefinitionV1Schema,
  MustBlockV1Schema,
  MustPredicatesV1Schema,
  ReusableConventionsPackageV1Schema,
  ReusableConventionV1Schema,
} from "./schemas.js";

export function defineConventions<
  const T extends readonly ReusableConventionV1[],
>(conventions: T): T {
  return conventions;
}
