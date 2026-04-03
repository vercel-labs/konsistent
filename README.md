# konsistent

_Enforce consistent code, for agents and humans._

konsistent is a CLI linter that checks whether files and directories in your TypeScript codebase match declared structural patterns. It fills a gap that ESLint, Biome, and oxlint don't cover: they enforce code style and best practices within files, but none of them verify project-level structural conventions — like "every provider package must export the same shape" or "every adapter must extend the base class."

Consistent project structure reduces cognitive overhead, simplifies onboarding, and makes codebases predictable. It also directly improves coding agent performance — agents exposed to consistent API conventions produce better code, faster.

## Install

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
        "export": ["${providerId}"],
        "exportTypes": [
          "${providerId.toPascalCase()}Provider",
          "${providerId.toPascalCase()}ProviderSettings"
        ]
      }
    }
  ]
}
```

Then install it in the project:

```bash
npm install konsistent --save-dev
```

Add it to your `package.json scripts:

```json
{
  "scripts": {
    "konsistent": "konsistent"
  }
}
```

Run it:

```bash
npm run konsistent
```

When violations are found:

```
packages/anthropic/src/index.ts
  -  error  Missing export type "AnthropicProvider"  [must-export-and-more]

packages/openai/src/index.ts
  -  error  Missing export "openai"  [must-export-and-more]
  -  error  Missing export type "OpenaiProviderSettings"  [must-export-and-more]

Checked 6 files in 10ms. Found 3 violations.
```

When everything passes:

```
Checked 6 files in 8ms. No violations found.
```

## CI integration

In GitHub Actions, konsistent automatically emits `::error` annotations so violations appear inline on pull request diffs. No flags needed.

Output formats are also available via `--format`:

- `default` — colored terminal output (default locally)
- `github` — GitHub Actions annotations (default in CI)
- `json` — machine-readable JSON array
- `markdown` — table format for PR comments

## License

MIT
