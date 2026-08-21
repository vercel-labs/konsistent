import {
  type Client as ApiClient,
  createClient as createApiClient,
} from "./dependencies";
import "./side-effect";

export const importedClient = createApiClient;
export type ImportedClient = ApiClient;
