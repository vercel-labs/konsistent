import {
  type Client as ApiClient,
  createClient as createApiClient,
} from "./dependencies";
import "./side-effect";

export const valueImportConditionPassed = createApiClient;
export const typeImportConditionPassed = {} as ApiClient;
export const valueImportFromConditionPassed = true;
export const typeImportFromConditionPassed = true;
