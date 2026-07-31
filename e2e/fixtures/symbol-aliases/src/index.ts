import {
  blockedImport as allowedLocalImport,
  createClient as createApiClient,
  parseInput as renamedParser,
} from "client-package";
import type {
  BlockedType as AllowedLocalType,
  ClientConfig as ApiClientConfig,
  LooseType as RenamedLooseType,
} from "client-types";

const createProvider = () => ({
  createApiClient,
  renamedParser,
});
type LocalSettings = {
  enabled?: boolean;
};

export { createProvider as createApiProvider };
export type { LocalSettings as PublicSettings };
export {
  blockedExport as allowedPublicExport,
  looseValue as renamedLooseValue,
  remoteValue as publicRemoteValue,
} from "./remote-values";
export type {
  BlockedExportType as AllowedPublicType,
  LooseRemoteType as RenamedLooseRemoteType,
  RemoteType as PublicRemoteType,
} from "./remote-types";

export type FixtureTypes = ApiClientConfig | RenamedLooseType | AllowedLocalType;
