# Getting started

This guide takes you from zero to a working `konsistent.json` in a few minutes.

## 1. Install

| NPM | PNPM | Bun |
| --- | --- | --- |
| `npm install konsistent --save-dev` | `pnpm add konsistent --save-dev` | `bun add konsistent --dev` |

Add a script to your `package.json`:

```json
{
  "scripts": {
    "konsistent": "konsistent"
  }
}
```

## 2. Create `konsistent.json`

Create `konsistent.json` at the project root with at least the `version` field and one convention. The simplest possible config has a single rule:

```json
{
  "$schema": "node_modules/konsistent/konsistent.schema.json",
  "version": "v1",
  "conventions": [
    {
      "paths": "packages/{name}",
      "must": {
        "haveType": "directory",
        "haveFiles": ["src/index.ts"]
      }
    }
  ]
}
```

This says: every `packages/<name>` is a directory and must contain `src/index.ts`.

The `$schema` line gives you autocomplete in editors that respect the JSON schema reference (VS Code, JetBrains, …).

## 3. Run the CLI

| NPM | PNPM | Bun |
| --- | --- | --- |
| `npm run konsistent` | `pnpm konsistent` | `bun konsistent` |

When everything passes:

```
Checked 6 files in 8ms. No violations found.
```

When violations are found:

```
packages/anthropic
  -  error  Missing required file "src/index.ts"  [must-have-files]

Checked 6 files in 10ms. Found 1 error.
```

## 4. Add more conventions

Most useful conventions involve **placeholders** — captured parts of the path you can reference inside `must`. For example, every package barrel must export a function named after the package:

```json
{
  "version": "v1",
  "conventions": [
    {
      "name": "package-barrels",
      "paths": "packages/{packageName}/src/index.ts",
      "must": {
        "export": ["${packageName}"]
      }
    }
  ]
}
```

For `packages/anthropic/src/index.ts`, the rule requires the file to export the binding `anthropic`. See [path-patterns.md](../reference/path-patterns.md) for the full placeholder syntax (case transformations, regex extraction, constraints).

## 5. Check the schema

After every edit, validate the config:

```bash
pnpm konsistent validate
```

The validator catches schema errors (typos, wrong types, unknown fields). If validation passes, run `pnpm konsistent` to apply the rules to the codebase.

## What to put in your config

If you're inheriting an existing codebase, don't write rules from scratch — explore the codebase first to identify the patterns that already exist. See [exploring-codebases.md](./exploring-codebases.md) for the systematic approach.

For inspiration, browse [examples.md](./examples.md) for a library of common patterns (provider packages, factory functions, adapter classes, conditional rules, …).

## What to do about violations

If `konsistent` reports many violations across the same rule, the rule itself may be wrong — the codebase may not have actually adopted that convention. See [fixing-violations.md](./fixing-violations.md) for the workflow that distinguishes "the rule is wrong" from "the code is wrong" and walks through fixing each.

## Next steps

- [konsistent.json reference](../reference/configuration.md) — full top-level shape and convention fields.
- [Predicates](../reference/predicates.md) — every `must` predicate with examples.
- [CI integration](./ci-integration.md) — wire `konsistent` into GitHub Actions.
