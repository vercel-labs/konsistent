import {
  anyAliasImport as renamedAnyAliasImport,
  blockedImport as forbiddenLocalImport,
  createClient as wrongClientAlias,
} from "client-package";
import type {
  AnyAliasType as RenamedAnyAliasType,
  BlockedType as ForbiddenLocalType,
  ClientConfig as WrongConfigAlias,
} from "client-types";

const createProvider = () => ({
  renamedAnyAliasImport,
  wrongClientAlias,
});
type LocalSettings = {
  enabled?: boolean;
};
const anyAliasExport = true;
type AnyAliasExportType = string;

export { createProvider as wrongProviderAlias };
export type { LocalSettings as WrongSettingsAlias };
export { anyAliasExport as renamedAnyAliasExport };
export type { AnyAliasExportType as RenamedAnyAliasExportType };
export { blockedExport as forbiddenPublicExport } from "./remote-values";
export type {
  BlockedExportType as ForbiddenPublicType,
} from "./remote-types";

export type FixtureTypes = RenamedAnyAliasType | ForbiddenLocalType;
