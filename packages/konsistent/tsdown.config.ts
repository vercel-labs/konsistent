import { defineConfig, mergeConfig } from "tsdown";
import { cliBaseConfig } from "../../tsdown.base.ts";

export default defineConfig(
  mergeConfig(cliBaseConfig, {
    deps: {
      neverBundle: ["@konsistent/convention"],
    },
    entry: ["src/cli.ts"],
    outDir: "dist",
  })
);
