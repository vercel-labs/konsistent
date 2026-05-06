# CLI

The `konsistent` CLI is the entry point for running checks, validating configs, and managing the tool itself.

## Commands

| Command | Description |
| --- | --- |
| `konsistent` | Shorthand for `konsistent check` |
| `konsistent check` | Check structural conventions against your `konsistent.json` |
| `konsistent validate` | Validate the `konsistent.json` configuration file |
| `konsistent help` | Show a quick reference of all commands and options |
| `konsistent version` | Print the version number |
| `konsistent update` | Update konsistent to the latest version |

`konsistent` invoked without a subcommand runs `check`. `konsistent --help` runs `help`. `konsistent --version` runs `version`.

## `check`

Loads `konsistent.json`, runs every convention against the codebase, and reports violations.

```bash
konsistent check
konsistent check --config-package @acme/shared-conventions
konsistent check --format=json --max-diagnostics=1000
konsistent check --error-on-warnings --diagnostic-level error
```

### Flags

| Flag | Type | Default | Description |
| --- | --- | --- | --- |
| `--config-path <path>` | string | `konsistent.json` (project root) | Path to the config file |
| `--config-package <pkg>` | string | — | NPM package name to load `konsistent.json` from. Resolved from the consuming project's `node_modules`. Mutually exclusive with `--config-path` |
| `--format <format>` | `default` \| `json` \| `github` \| `markdown` | `default` (auto-detects `github` in CI) | Output format |
| `--verbose` | boolean | `false` | Show execution time and expanded details |
| `--max-diagnostics <n>` | string (parsed as integer) | `100` | Maximum diagnostics to print before truncating |
| `--colors` / `--no-colors` | boolean | auto | Force-enable or disable terminal colors (default format only) |
| `--error-on-warnings` | boolean | `false` | Treat warnings as errors for the exit code |
| `--diagnostic-level <level>` | `warning` \| `error` | `warning` | Minimum severity to evaluate. `error` skips warning-severity conventions entirely |

### Exit codes

- `0` — no errors (warnings allowed unless `--error-on-warnings` is set).
- `1` — errors found, or config could not be loaded.

## `validate`

Parses and validates `konsistent.json` against the schema without running any checks against the filesystem.

```bash
konsistent validate
konsistent validate --config-path=path/to/konsistent.json
konsistent validate --config-package @acme/shared-conventions
```

Exits `0` and prints `Configuration is valid.` on success. Exits `1` with a Zod validation error on failure.

`validate` accepts the same `--config-path` and `--config-package` flags as `check` (see the table above).

## Output formats

### `default`

Colored terminal output. Files are grouped, diagnostics sorted by line.

```
packages/anthropic/src/index.ts
  -  error  Missing export type "AnthropicProvider"  [must-export-and-more]

packages/openai/src/index.ts
  -  error  Missing export "openai"  [must-export-and-more]
  -  error  Missing export type "OpenAIProviderSettings"  [must-export-and-more]

Checked 6 files in 10ms. Found 3 errors.
```

When everything passes:

```
Checked 6 files in 8ms. No violations found.
```

### `github`

GitHub Actions annotations (`::error file=...,line=...::message`). Auto-selected when `GITHUB_ACTIONS=true` is set in the environment, so `konsistent check` in a GitHub workflow needs no extra flags.

### `json`

Machine-readable JSON array. Each entry has the shape:

```json
[
  {
    "severity": "error",
    "conventionName": "must-export-and-more",
    "filePath": "packages/openai/src/index.ts",
    "predicateName": "export",
    "message": "Missing export \"openai\"",
    "line": 1
  }
]
```

`severity` is `"error"` or `"warning"`. `line` is omitted when the diagnostic isn't tied to a specific line (e.g., a missing-file diagnostic).

Use `json` when scripting around the CLI (CI gating, custom reports, or driving an agent).

### `markdown`

Markdown table format suitable for posting as a PR comment.

## Truncation

When the number of diagnostics exceeds `--max-diagnostics`, only the first `n` are printed and a truncation summary is appended:

```
… and 437 more diagnostics omitted. Increase --max-diagnostics to see all.
```

The exit code still reflects all violations — only the printed output is truncated.
