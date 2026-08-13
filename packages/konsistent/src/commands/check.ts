import { defineCommand } from "citty";
import pc from "picocolors";
import {
  loadConfig,
  normalizePlaceholderArg,
  parseCliPlaceholders,
} from "../config/index.js";
import { printDeprecationWarnings } from "../core/command-utils/print-deprecation-warnings.js";
import { parseRepeatedStringOption } from "../core/command-utils/repeated-string-option.js";
import type { FileSystem, PathSelection, Reporter } from "../core/index.js";
import {
  allPathSelection,
  createDefaultReporter,
  createGitClient,
  createGithubReporter,
  createJsonReporter,
  createMarkdownReporter,
  createRealFileSystem,
  createTargetedPathSelection,
  resolvePathSelectors,
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
  paths: {
    type: "string" as const,
    description:
      "Path or glob to check. May be passed multiple times. Mutually exclusive with --staged and --modified.",
  },
  staged: {
    type: "boolean" as const,
    description: "Check files currently staged in Git",
    default: false,
  },
  modified: {
    type: "boolean" as const,
    description:
      "Check staged, unstaged, and untracked files that are not ignored by Git",
    default: false,
  },
};

interface PathSelectionOptions {
  modified: boolean;
  paths: string[];
  staged: boolean;
}

type PathSelectionOptionsResult =
  | { success: true; options: PathSelectionOptions }
  | { success: false; error: string };

function parsePathSelectionOptions(opts: {
  rawArgs: string[];
  staged: boolean;
  modified: boolean;
}): PathSelectionOptionsResult {
  const pathArgsResult = parseRepeatedStringOption({
    rawArgs: opts.rawArgs,
    name: "--paths",
  });
  if (!pathArgsResult.success) {
    return pathArgsResult;
  }

  const selectionModeCount =
    Number(pathArgsResult.values.length > 0) +
    Number(opts.staged) +
    Number(opts.modified);
  if (selectionModeCount > 1) {
    return {
      success: false,
      error: "--paths, --staged, and --modified are mutually exclusive",
    };
  }

  return {
    success: true,
    options: {
      paths: pathArgsResult.values,
      staged: opts.staged,
      modified: opts.modified,
    },
  };
}

async function resolveCheckPathSelection(opts: {
  options: PathSelectionOptions;
  cwd: string;
  fileSystem: FileSystem;
}): Promise<{ pathSelection: PathSelection; emptyWarning?: string }> {
  if (opts.options.paths.length > 0) {
    return {
      pathSelection: await resolvePathSelectors({
        selectors: opts.options.paths,
        cwd: opts.cwd,
        fileSystem: opts.fileSystem,
      }),
      emptyWarning: "No paths matched --paths. Nothing to check.",
    };
  }

  if (opts.options.staged || opts.options.modified) {
    const gitClient = createGitClient({
      cwd: opts.cwd,
      fileSystem: opts.fileSystem,
    });
    const selectedPaths = opts.options.staged
      ? await gitClient.listStagedPaths()
      : await gitClient.listModifiedPaths();
    return {
      pathSelection: createTargetedPathSelection({ selectedPaths }),
      emptyWarning: opts.options.staged
        ? "No staged files found. Nothing to check."
        : "No modified files found. Nothing to check.",
    };
  }

  return { pathSelection: allPathSelection };
}

function printEmptySelectionWarning(opts: {
  pathSelection: PathSelection;
  warning?: string;
}): void {
  if (
    opts.pathSelection.mode === "targeted" &&
    opts.pathSelection.selectedPaths.length === 0 &&
    opts.warning
  ) {
    console.warn(pc.yellow(opts.warning));
  }
}

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
  async run({ args, rawArgs }) {
    const pathSelectionOptions = parsePathSelectionOptions({
      rawArgs,
      staged: args.staged,
      modified: args.modified,
    });
    if (!pathSelectionOptions.success) {
      console.error(pc.red(pathSelectionOptions.error));
      process.exit(1);
      return;
    }

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

    printDeprecationWarnings({ config: result.config });

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
    let resolvedPathSelection: Awaited<
      ReturnType<typeof resolveCheckPathSelection>
    >;
    try {
      resolvedPathSelection = await resolveCheckPathSelection({
        options: pathSelectionOptions.options,
        cwd: process.cwd(),
        fileSystem,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(pc.red(message));
      process.exit(1);
      return;
    }

    printEmptySelectionWarning({
      pathSelection: resolvedPathSelection.pathSelection,
      warning: resolvedPathSelection.emptyWarning,
    });

    const runResult = await run({
      config,
      fileSystem,
      pathSelection: resolvedPathSelection.pathSelection,
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
