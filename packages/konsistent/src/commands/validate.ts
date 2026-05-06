import { defineCommand } from "citty";
import pc from "picocolors";
import { loadConfig } from "../config/index.js";

const validateArgs = {
  "config-path": {
    type: "string" as const,
    description: "Path to konsistent.json config file",
  },
  "config-package": {
    type: "string" as const,
    description:
      "NPM package name to load konsistent.json from (alternative to --config-path)",
  },
};

export default defineCommand({
  meta: {
    name: "validate",
    description: "Validate configuration",
  },
  args: validateArgs,
  async run({ args }) {
    const result = await loadConfig({
      configPath: args["config-path"],
      configPackage: args["config-package"],
    });
    if (!result.success) {
      console.error(pc.red(result.error));
      process.exit(1);
      return;
    }
    console.log(pc.green("Configuration is valid."));
  },
});
