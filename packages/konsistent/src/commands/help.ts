import { defineCommand } from 'citty';
import { getVersion } from '../version.js';

const HELP_TEXT = `konsistent v${getVersion()} — Enforce structural conventions in TypeScript codebases

Usage:
  konsistent [command] [options]

Commands:
  check       Check structural conventions (default)
  validate    Validate configuration
  version     Print the version number
  help        Show this help message

Check options:
  --config-path <path>    Path to konsistent.json config file
  --format <format>       Output format (default, json, github, markdown)
  --verbose               Show execution time and expanded details
  --max-diagnostics <n>   Maximum number of diagnostics to report (default: 20)
  --no-colors             Disable colored output (only for default format)

Validate options:
  --config-path <path>    Path to konsistent.json config file

Global options:
  --help, -h              Show help
  --version               Print the version number`;

export default defineCommand({
  meta: {
    name: 'help',
    description: 'Show help message',
  },
  run() {
    console.log(HELP_TEXT);
  },
});
