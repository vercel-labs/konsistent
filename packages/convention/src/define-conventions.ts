import type { ReusableConventionV1 } from "./schemas.js";

export function defineConventions<
  const T extends readonly ReusableConventionV1[],
>(conventions: T): T {
  return conventions;
}
