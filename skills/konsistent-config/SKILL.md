---
name: konsistent-config
description: >
  Create or modify a konsistent.json configuration file that enforces structural conventions in a TypeScript codebase.
  Use when the user wants to enforce consistent code structure, validate exports/imports across files,
  ensure directories contain required files, enforce naming patterns, add/remove/update convention rules,
  configure case map overrides for acronyms or special casing (kebabToPascalMap, kebabToCamelMap),
  or troubleshoot why konsistent is reporting violations.
  Triggers on: "konsistent", "konsistent.json", "enforce conventions", "structural consistency",
  "consistent exports", "consistent structure", "code conventions config", "add convention",
  "update convention", "fix konsistent errors", "case map", "case override", "acronym casing".
---

# konsistent Configuration

Create or modify a `konsistent.json` file that enforces structural conventions for the project. The `konsistent` CLI checks filesystem structure and TypeScript exports/imports — it is not a style linter.

## Workflow

1. Check if `konsistent.json` already exists at the project root
2. Read `node_modules/konsistent/konsistent.schema.json` to confirm available predicates
3. Read [references/predicates.md](references/predicates.md) for predicate details and examples
4. If `konsistent.json` exists: read it, then add/remove/update conventions as requested by the user
5. If `konsistent.json` does not exist: create it at the project root

Before creating a new config, or if the user has not provided any specific requests for editing an existing config, you must:
- Explore the user's codebase to understand existing structure and naming patterns
- Refer to (references/codebase-exploration.md)[references/codebase-exploration.md] for what to look out for

When modifying an existing config:
- Preserve all conventions not related to the user's request
- Preserve existing `name`, `description`, and `severity` values unless asked to change them
- When adding conventions, append to the `conventions` array
- When the user reports violations, read the existing config and the violating files to determine whether to fix the config or advise fixing the code

## Config Structure

```json
{
  "$schema": "node_modules/konsistent/konsistent.schema.json",
  "version": "v1",
  "kebabToPascalMap": { ... },
  "kebabToCamelMap": { ... },
  "conventions": [
    {
      "name": "optional-kebab-case-id",
      "description": "Optional human description",
      "severity": "error",
      "paths": "src/modules/{moduleName}",
      "must": { ... }
    }
  ]
}
```

Required fields per convention: `paths`, `must`. Optional: `name`, `description`, `severity` (default: `"error"`).

## Case Map Overrides

By default, case transformations like `toPascalCase()` convert `openai` → `Openai`. For acronyms or special casing, declare override maps at the top level of `konsistent.json`:

- `kebabToPascalMap` — overrides `toPascalCase()` and `toNthSegmentPascalCase()`
- `kebabToCamelMap` — overrides `toCamelCase()` and `toNthSegmentCamelCase()`

Inverse maps (`toKebabCase()`, `toSnakeCase()` from PascalCase/camelCase) and cross-maps (`camelToPascal`, `pascalToCamel`) are derived automatically.

```json
{
  "version": "v1",
  "conventions": [
    {
      "paths": "providers/{providerId}/index.ts",
      "must": {
        "exportFunctions": [
          { "name": "create${providerId.toPascalCase()}Provider" }
        ]
      }
    }
  ],
  "kebabToPascalMap": {
    "openai": "OpenAI",
    "graphql": "GraphQL"
  },
  "kebabToCamelMap": {
    "openai": "openAI"
  }
}
```

With the above config, `providerId` = `openai` resolves `create${providerId.toPascalCase()}Provider` to `createOpenAIProvider` instead of `createOpenaiProvider`.

Use case map overrides when the codebase contains identifiers with acronyms (API, AI, DB, URL, etc.) or unconventional casing that default transformations get wrong.

## Path Patterns and Placeholders

Paths use glob patterns with placeholder extraction via `{name}` syntax:

- `packages/{pkgName}` — matches directories, extracts `pkgName`
- `services/{svcName}/index.ts` — matches files, extracts `svcName`

Placeholders become available as templates `${pkgName}` inside `must` predicates. Case transformations:

- `${name}` or `${name.toString()}` — raw value
- `${name.toPascalCase()}` — `my-thing` → `MyThing`
- `${name.toCamelCase()}` — `my-thing` → `myThing`
- `${name.toKebabCase()}` — `MyThing` → `my-thing`
- `${name.toSnakeCase()}` — `MyThing` → `my_thing`
- `${name.toFlatCase()}` — `my-thing` → `mything`
- `${name.toNthSegment(0)}` — `my-thing` → `my` (split by `-`, return nth segment)
- `${name.toNthSegmentPascalCase(0)}` — `my-thing` → `My` (nth segment with PascalCase)
- `${name.toNthSegmentCamelCase(0)}` — `my-thing` → `my` (nth segment with camelCase)

### Path Negation

Exclude specific paths with `!` prefix:

```json
"paths": [
  "packages/{packageName}/src/index.ts",
  "!packages/test-utils/src/index.ts"
]
```

## Conditional and Iterative Rules

When `must` is an array, each element is a block that can have `if` and `for`:

```json
"must": [
  { "must": { "haveFiles": ["index.ts"] } },
  {
    "if": { "hasFile": "test.ts" },
    "must": { "import": ["describe"] }
  },
  {
    "for": { "files": "{storyFile}.stories.tsx" },
    "must": { "exportConstants": ["meta"] }
  }
]
```

- `if.hasFile` — block only runs if file exists (templates resolved from parent placeholders)
- `for.files` — iterates over matched files, extracting new placeholders via `{name}` syntax

## Common Patterns

### Provider/plugin packages

```json
{
  "paths": "packages/{name}",
  "must": {
    "haveType": "directory",
    "haveFiles": ["src/index.ts", "src/${name}-provider.ts"]
  }
}
```

### Barrel file exports matching directory name

```json
{
  "paths": "packages/{name}/src/index.ts",
  "must": {
    "export": ["${name}"],
    "exportTypes": ["${name.toPascalCase()}Config"]
  }
}
```

### Factory function with typed signature

```json
{
  "paths": "services/{name}/index.ts",
  "must": {
    "exportFunctions": [{
      "name": "create${name.toPascalCase()}",
      "receiveParamOfType": "${name.toPascalCase()}Config",
      "returnValueOfType": "${name.toPascalCase()}"
    }]
  }
}
```

### Interface inheritance

```json
{
  "paths": "adapters/{name}/adapter.ts",
  "must": {
    "exportClasses": [{ "name": "${name.toPascalCase()}Adapter", "extend": "BaseAdapter" }],
    "importTypes": [{ "name": "BaseAdapter", "from": "../base" }]
  }
}
```

### Mixed severity

```json
{
  "severity": "error",
  "paths": "modules/{name}",
  "must": { "haveFiles": ["index.ts"] }
},
{
  "severity": "warning",
  "paths": "modules/{name}",
  "must": { "haveFiles": ["README.md"] }
}
```

## Guidelines

- Explore the user's project first — understand actual directory structure, naming conventions, and patterns before writing rules
- Use `severity: "warning"` for conventions that are recommended but not mandatory
- Use `name` on conventions to give them identifiable IDs (must be kebab-case)
- Use `description` when the convention name alone isn't self-explanatory
- Prefer templates with case transformations over hardcoded names — this is konsistent's key strength
- Group related predicates in one convention when they apply to the same path
- Use separate conventions for the same path when different severities are needed
- Use path negation to exclude known exceptions rather than listing all included paths
- Check `package.json` for a `konsistent` script (e.g. `"konsistent": "konsistent"`) — if present, use `npm run konsistent` (or the project's package manager equivalent) instead of `npx konsistent`
- Validate the generated config by running `konsistent validate`
- Test the config against the actual codebase by running `konsistent` (with no arguments)

**Important reminder:** The objective is NOT to write a `konsistent.json` file that leads to zero errors when running the CLI. That would defeat the purpose. The objective is to create a konsistent.json file that identifies violations to patterns used in the codebase, even if they are not being 100% adhered to.
