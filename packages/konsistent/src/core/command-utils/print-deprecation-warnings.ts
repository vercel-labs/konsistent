import pc from "picocolors";
import { collectDeprecationWarnings } from "../../config/deprecation-warnings.js";
import type { ConfigV1 } from "../../config/schema.js";

export function printDeprecationWarnings(opts: { config: ConfigV1 }): void {
  for (const warning of collectDeprecationWarnings({ config: opts.config })) {
    console.warn(pc.yellow(warning));
  }
}
