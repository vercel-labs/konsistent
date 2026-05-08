import { defineCommand } from "citty";
import pc from "picocolors";
import {
  loadConfig,
  normalizePlaceholderArg,
  parseCliPlaceholders,
} from "../config/index.js";
import type { Reporter } from "../core/index.js";
import {
  createDefaultReporter,
  createGithubReporter,
  createJsonReporter,
  createMarkdownReporter,
  createRealFileSystem,
  run,
} from "../core/index.js";
import {
  formatTruncationMessage,
  truncateDiagnostics,
} from "../core/truncate-diagnostics.js";

const checkArgs = {
  "config-path": {
    type: "string" as const,
    description: "Path to konsistent.json config file",
  },
  "config-package": {
    type: "string" as const,
    description:
      "NPM package name to load konsistent.json from (alternative to --config-path)",
  },
  format: {
    type: "string" as const,
    description: "Output format (default, json, github, markdown)",
    default: "default",
  },
  verbose: {
    type: "boolean" as const,
    description: "Show execution time and expanded details",
    default: false,
  },
  "max-diagnostics": {
    type: "string" as const,
    description: "Maximum number of diagnostics to report",
    default: "100",
  },
  colors: {
    type: "boolean" as const,
    description: "Enable or disable colored output",
  },
  "error-on-warnings": {
    type: "boolean" as const,
    description: "Treat warnings as errors for exit code purposes",
    default: false,
  },
  "diagnostic-level": {
    type: "string" as const,
    description:
      'Minimum diagnostic severity to evaluate (warning or error). When set to "error", warning-severity conventions are skipped entirely.',
    default: "warning",
  },
  placeholder: {
    type: "string" as const,
    description:
      'Inject a placeholder value into every convention\'s placeholders map (overriding any existing entry). Format: "name:value". May be passed multiple times.',
  },
};

export function resolveFormat(opts: { format: string }): string {
  if (opts.format !== "default") {
    return opts.format;
  }
  if (process.env.GITHUB_ACTIONS === "true") {
    return "github";
  }
  return "default";
}

function createReporter(opts: { format: string; colors?: boolean }): Reporter {
  if (opts.format === "json") {
    return createJsonReporter();
  }
  if (opts.format === "github") {
    return createGithubReporter();
  }
  if (opts.format === "markdown") {
    return createMarkdownReporter();
  }
  return createDefaultReporter({ colors: opts.colors });
}

export default defineCommand({
  meta: {
    name: "check",
    description: "Check structural conventions",
  },
  args: checkArgs,
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

    const diagnosticLevel =
      args["diagnostic-level"] === "error" ? "error" : "warning";
    const config =
      diagnosticLevel === "error"
        ? {
            ...result.config,
            conventions: result.config.conventions.filter(
              (c) => (c.severity ?? "error") !== "warning"
            ),
          }
        : result.config;

    const fileSystem = createRealFileSystem({ cwd: process.cwd() });
    const runResult = await run({
      config,
      fileSystem,
    });

    const maxDiags = Number.parseInt(args["max-diagnostics"], 10) || 100;
    const { diagnostics: reported, omitted } = truncateDiagnostics({
      diagnostics: runResult.diagnostics,
      max: maxDiags,
    });

    const format = resolveFormat({ format: args.format });
    const reporter = createReporter({ format, colors: args.colors });
    const formatted = reporter.format({ ...runResult, diagnostics: reported });

    const output: string[] = [];
    if (formatted) {
      output.push(formatted);
    }
    if (omitted > 0) {
      output.push(formatTruncationMessage(omitted));
    }
    if (output.length > 0) {
      process.stdout.write(`${output.join("\n")}\n`);
    }

    const hasErrors = runResult.diagnostics.some((d) => d.severity === "error");
    const hasWarnings = runResult.diagnostics.some(
      (d) => d.severity === "warning"
    );
    if (hasErrors || (args["error-on-warnings"] && hasWarnings)) {
      process.exit(1);
    }
  },
});
