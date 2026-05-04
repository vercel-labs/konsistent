# konsistent documentation

`konsistent` is a CLI linter that checks whether files and directories in your TypeScript codebase match declared structural patterns. It fills a gap that ESLint, Biome, and oxlint don't cover: they enforce code style and best practices within files, but none of them verify project-level structural conventions — like "every provider package must export the same shape" or "every adapter must extend the base class."

## Where to start

- **New here?** [Getting started](./guides/getting-started.md) — install, write your first config, run the CLI.
- **Inheriting a codebase?** [Exploring codebases](./guides/exploring-codebases.md) — how to identify patterns worth enforcing before writing rules.
- **Have violations?** [Fixing violations](./guides/fixing-violations.md) — workflow for triaging and resolving them.

## Guides

- [Getting started](./guides/getting-started.md)
- [Examples](./guides/examples.md) — common patterns library.
- [Exploring codebases](./guides/exploring-codebases.md) — what to look for before writing rules.
- [Fixing violations](./guides/fixing-violations.md) — triage workflow.
- [CI integration](./guides/ci-integration.md) — GitHub Actions, output formats, PR comments.

## Reference

- [CLI](./reference/cli.md) — commands, flags, output formats, exit codes.
- [konsistent.json configuration](./reference/configuration.md) — top-level schema and convention shape.
- [Path patterns](./reference/path-patterns.md) — globs, placeholders, case transformations, negation.
- [Predicates](./reference/predicates.md) — every `must` predicate (`haveType`, `haveFiles`, `export`, `exportTypes`, `exportConstants`, `exportFunctions`, `exportInterfaces`, `exportClasses`, `import`, `importTypes`).
- [Constraints](./reference/constraints.md) — `matches`, `segments` for filtering placeholders.
- [Conditional rules](./reference/conditional-rules.md) — `if`, `for`, `excludeFiles` blocks inside `must` arrays.
- [Case maps](./reference/case-maps.md) — `kebabToPascalMap`, `kebabToCamelMap` for acronyms and special casing.

## Schema

The full machine-readable schema lives in the published package at `node_modules/konsistent/konsistent.schema.json`. Reference it from your `konsistent.json` for editor autocomplete:

```json
{
  "$schema": "node_modules/konsistent/konsistent.schema.json",
  "version": "v1",
  "conventions": []
}
```
