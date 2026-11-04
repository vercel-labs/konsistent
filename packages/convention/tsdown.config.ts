import { defineConfig, mergeConfig } from "tsdown";
import { cliBaseConfig, sdkBaseConfig } from "../../tsdown.base.ts";

export default defineConfig([
  mergeConfig(sdkBaseConfig, {
    entry: ["src/index.ts"],
    outDir: "dist",
  }),
  mergeConfig(cliBaseConfig, {
    entry: ["src/cli.ts"],
    outDir: "dist",
  }),
]);
