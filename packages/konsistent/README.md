# konsistent

_Enforce consistent code, for agents and humans._

`konsistent` is a CLI linter that checks whether files and directories in your TypeScript codebase match declared structural patterns. It fills a gap that ESLint, Biome, and oxlint don't cover: they enforce code style and best practices within files, but none of them verify project-level structural conventions — like "every provider package must export the same shape" or "every adapter must extend the base class."

Consistent project structure reduces cognitive overhead, simplifies onboarding, and makes codebases predictable. It also directly improves coding agent performance — agents exposed to consistent API conventions produce better code, faster.

## Usage

Create a `konsistent.json` in your project root:

```json
{
  "version": "v1",
  "conventions": [
    {
      "name": "provider-packages",
      "paths": "packages/{providerId}",
      "must": {
        "haveType": "directory",
        "haveFiles": ["src/index.ts", "src/${providerId}-provider.ts"]
      }
    },
    {
      "paths": "packages/{providerId}/src/index.ts",
      "must": {
        "export": ["${providerId.toFlatCase()}"],
        "exportTypes": [
          "${providerId.toPascalCase()}Provider",
          "${providerId.toPascalCase()}ProviderSettings"
        ]
      }
    }
  ],
  "kebabToPascalMap": {
    "openai": "OpenAI"
  },
  "kebabToCamelMap": {
    "openai": "openAI"
  }
}
```

Then install it in the project:

| NPM | PNPM | Bun |
| --- | --- | --- |
| `npm install konsistent --save-dev` | `pnpm add konsistent --save-dev` | `bun add konsistent --dev` |

Add it to your `package.json scripts:

```json
{
  "scripts": {
    "konsistent": "konsistent"
  }
}
```

Run it:

| NPM | PNPM | Bun |
| --- | --- | --- |
| `npm run konsistent` | `pnpm konsistent` | `bun konsistent` |

When violations are found:

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

## Commands

| Command | Description |
| --- | --- |
| `konsistent` | Shorthand for `konsistent check` |
| `konsistent check` | Check structural conventions |
| `konsistent validate` | Validate the `konsistent.json` configuration file |
| `konsistent help` | Show a quick reference of all commands and options |
| `konsistent version` | Print the version number |

## Severity

By default, convention violations are errors and cause a non-zero exit code. To mark a convention as a warning instead, add `"severity": "warning"`:

```json
{
  "version": "v1",
  "conventions": [
    {
      "paths": "packages/{name}/src/index.ts",
      "severity": "warning",
      "must": {
        "exportTypes": ["${name.toPascalCase()}Config"]
      }
    }
  ]
}
```

Warnings are displayed in yellow and do not cause a non-zero exit code. Use `--error-on-warnings` to treat warnings as errors in strict CI pipelines, or `--diagnostic-level error` to skip warning conventions entirely.

## CI integration

In GitHub Actions, konsistent automatically emits `::error` and `::warning` annotations so violations appear inline on pull request diffs. No flags needed.

Output formats are also available via `--format`:

- `default` — colored terminal output (default locally)
- `github` — GitHub Actions annotations (default in CI)
- `json` — machine-readable JSON array
- `markdown` — table format for PR comments

## License

MIT
