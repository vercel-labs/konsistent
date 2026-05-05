import type { ReusableConventionV1 } from "./schemas.js";

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
} from "./schemas.js";
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
} from "./schemas.js";

export function defineConventions<
  const T extends readonly ReusableConventionV1[],
>(conventions: T): T {
  return conventions;
}
