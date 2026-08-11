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
konsistent check --paths packages/core --paths 'packages/ui/**/*.tsx'
konsistent check --staged
konsistent check --modified
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
| `--placeholder <name:value>` | string (repeatable) | — | Inject a placeholder into every convention's `placeholders` map, overriding any entry already there. May be passed multiple times. See [Static placeholder values](./path-patterns.md#static-placeholder-values) |
| `--paths <path-or-glob>` | string (repeatable) | — | Check concrete files, recursive directories, or glob patterns relative to the current directory |
| `--staged` | boolean | `false` | Check files added, copied, modified, or renamed in the Git index |
| `--modified` | boolean | `false` | Check staged and unstaged tracked changes plus untracked files that are not ignored by Git |

`--paths`, `--staged`, and `--modified` are mutually exclusive. Without one of them, `check` continues to evaluate the full codebase under the current directory.

Quote glob patterns so Konsistent expands them consistently instead of relying on shell expansion. Concrete directories are recursive. Negated patterns may filter a positive selector but cannot be used alone. Absolute paths are accepted only when they remain inside the current directory. A selected file activates structural conventions for its ancestor directories, while nested `for.files` blocks remain restricted to selected descendants.

Git modes use the repository containing the current directory and process the current contents on disk. `--staged` therefore includes unstaged edits made to a staged file. `--modified` also includes untracked files unless Git ignores them. Deleted paths cannot be checked and are excluded.

When a selection contains no paths, Konsistent prints a warning to stderr, checks zero paths, and exits successfully. The warning is operational output rather than a convention diagnostic, so `--error-on-warnings` does not change that result and JSON stdout remains valid.

### Exit codes

- `0` — no errors (warnings allowed unless `--error-on-warnings` is set).
- `1` — errors found, config could not be loaded, selection flags conflict, or Git/path selection fails.

## `validate`

Parses and validates `konsistent.json` against the schema without running any checks against the filesystem.

```bash
konsistent validate
konsistent validate --config-path=path/to/konsistent.json
konsistent validate --config-package @acme/shared-conventions
```

Exits `0` and prints `Configuration is valid.` on success. Exits `1` with a Zod validation error on failure.

`validate` accepts the same `--config-path`, `--config-package`, and `--placeholder` flags as `check` (see the table above).

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
    "predicateName": "exportValues",
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
