import { defineCommand } from "citty";
import { getVersion } from "../version.js";

const helpArgs = {};

const HELP_TEXT = `konsistent v${getVersion()} — Enforce structural conventions in TypeScript codebases

Usage:
  konsistent [command] [options]

Commands:
  check       Check structural conventions (default)
  validate    Validate configuration
  update      Update konsistent to the latest version
  version     Print the version number
  help        Show this help message

Check options:
  --config-path <path>       Path to konsistent.json config file
  --config-package <pkg>     NPM package to load konsistent.json from (alternative to --config-path)
  --format <format>          Output format (default, json, github, markdown)
  --verbose                  Show execution time and expanded details
  --max-diagnostics <n>      Maximum number of diagnostics to report (default: 100)
  --no-colors                Disable colored output (only for default format)
  --error-on-warnings        Treat warnings as errors for exit code purposes
  --diagnostic-level <level> Minimum severity to evaluate: warning (default) or error
  --paths <path-or-glob>      Path or glob to check (repeatable)
  --staged                    Check files currently staged in Git
  --modified                  Check staged, unstaged, and untracked non-ignored files

Validate options:
  --config-path <path>    Path to konsistent.json config file
  --config-package <pkg>  NPM package to load konsistent.json from (alternative to --config-path)

Global options:
  --help, -h              Show help
  --version               Print the version number`;

export default defineCommand({
  meta: {
    name: "help",
    description: "Show help message",
  },
  args: helpArgs,
  run() {
    console.log(HELP_TEXT);
  },
});
