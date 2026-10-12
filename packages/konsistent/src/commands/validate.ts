import { defineCommand } from "citty";
import pc from "picocolors";
import {
  loadConfig,
  normalizePlaceholderArg,
  parseCliPlaceholders,
} from "../config/index.js";
import { printDeprecationWarnings } from "../core/command-utils/print-deprecation-warnings.js";

const validateArgs = {
  "config-package": {
    description:
      "NPM package name to load konsistent.json from (alternative to --config-path)",
    type: "string" as const,
  },
  "config-path": {
    description: "Path to konsistent.json config file",
    type: "string" as const,
  },
  placeholder: {
    description:
      'Inject a placeholder value into every convention\'s placeholders map (overriding any existing entry). Format: "name:value". May be passed multiple times.',
    type: "string" as const,
  },
};

export default defineCommand({
  args: validateArgs,
  meta: {
    description: "Validate configuration",
    name: "validate",
  },
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
      cliPlaceholders: cliPlaceholdersResult.placeholders,
      configPackage: args["config-package"],
      configPath: args["config-path"],
    });
    if (!result.success) {
      console.error(pc.red(result.error));
      process.exit(1);
      return;
    }
    printDeprecationWarnings({ config: result.config });
    console.log(pc.green("Configuration is valid."));
  },
});
