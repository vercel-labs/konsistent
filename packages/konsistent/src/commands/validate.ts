import { defineCommand } from "citty";
import pc from "picocolors";
import { collectDeprecationWarnings } from "../config/deprecation-warnings.js";
import {
  loadConfig,
  normalizePlaceholderArg,
  parseCliPlaceholders,
} from "../config/index.js";

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
  placeholder: {
    type: "string" as const,
    description:
      'Inject a placeholder value into every convention\'s placeholders map (overriding any existing entry). Format: "name:value". May be passed multiple times.',
  },
};

export default defineCommand({
  meta: {
    name: "validate",
    description: "Validate configuration",
  },
  args: validateArgs,
  async run({ args }) {
    const cliPlaceholdersResult = parseCliPlaceholders({
      raw: normalizePlaceholderArg(args.placeholder),
    });
    if (!cliPlaceholdersResult.success) {
      console.error(pc.red(cliPlaceholdersResult.error));
      process.exit(1);
      return;
    }
    const result = await loadConfig({
      configPath: args["config-path"],
      configPackage: args["config-package"],
      cliPlaceholders: cliPlaceholdersResult.placeholders,
    });
    if (!result.success) {
      console.error(pc.red(result.error));
      process.exit(1);
      return;
    }
    for (const warning of collectDeprecationWarnings({
      config: result.config,
    })) {
      console.warn(pc.yellow(warning));
    }
    console.log(pc.green("Configuration is valid."));
  },
});
