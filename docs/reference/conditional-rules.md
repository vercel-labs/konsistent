# Conditional rules

When a convention's `must` is an **array** of blocks instead of a single object, each block can have its own conditions, scope, and predicates. This unlocks rules like "story files must export `meta`" or "test files must import the project's custom render helper" — structural conventions that linters and the type checker won't catch on their own.

## Object form vs. array form

The object form applies one set of predicates unconditionally to every matched path:

```json
{
  "paths": "packages/{name}",
  "must": {
    "haveType": "directory",
    "haveFiles": ["src/index.ts"]
  }
}
```

The array form is a list of `MustBlock`s. Each block independently decides whether and how to apply:

```json
{
  "paths": "components/{componentName}",
  "must": [
    { "must": { "haveFiles": ["index.tsx"] } },
    {
      "if": { "hasFile": "index.test.tsx" },
      "for": { "files": "index.test.tsx" },
      "must": { "importValues": [{ "name": "render", "from": "@/test-utils" }] }
    },
    {
      "for": { "files": "*.stories.tsx" },
      "must": { "exportConstants": ["meta"] }
    }
  ]
}
```

Switch from object to array form when you need:
- Different predicates for different files inside the same directory.
- Predicates that apply only when an optional file exists.
- Predicates that apply only to a subset of placeholder values.
- Predicates that apply only when a file imports a specific symbol or source.

## `MustBlock` shape

```json
{
  "name": "test-render-helper",
  "description": "Component test files must use the project's custom render helper",
  "if": { "hasFile": "index.test.tsx" },
  "for": { "files": "index.test.tsx" },
  "excludeFiles": ["components/legacy/**"],
  "must": { "importValues": [{ "name": "render", "from": "@/test-utils" }] },
  "mustNot": { "exportConstants": ["debug"] }
}
```

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `must` | `MustPredicates` | yes, unless `mustNot` is present | The predicates this block enforces. See [predicates.md](./predicates.md). |
| `mustNot` | `MustPredicates` | yes, unless `must` is present | The predicates this block forbids. |
| `if` | condition object | no | Gate. Block runs only if one supported condition holds. |
| `for` | `{ files: string \| string[] }` | no | Scope. Predicates apply to files matching this pattern within the parent path. |
| `excludeFiles` | `string[]` | no | Glob patterns to exclude from the block. |
| `name` | string matching `[a-z0-9-]+` | no | Identifier shown in violation reports. |
| `description` | string | no | Human-readable explanation. |

## `if.hasFile`

Block applies only when the named file exists at (or relative to) the matched path. Templates are resolved using the parent placeholders.

```json
{
  "paths": "components/{componentName}",
  "must": [
    {
      "if": { "hasFile": "index.test.tsx" },
      "for": { "files": "index.test.tsx" },
      "must": { "importValues": [{ "name": "render", "from": "@/test-utils" }] }
    }
  ]
}
```

For `components/Button`, the block runs only if `components/Button/index.test.tsx` exists. Components without test files are skipped — no false-positive "missing export" violations.

## `if.placeholderSatisfies`

Block applies only when the named placeholder satisfies a constraint. Syntax, constraint catalog, and examples in [constraints.md](./constraints.md#ifplaceholdersatisfies).

## Import conditions

Import conditions inspect the file at the matched `paths` entry. They return false when the matched path is a directory. Conditions run before `for.files`, so they always inspect the parent matched path rather than files selected by `for`.

| Condition | Value | Applies when |
| --- | --- | --- |
| `hasValueImport` | string or `{ name, from? }` | The file imports the named value, optionally from an exact source. |
| `hasValueImportFrom` | string | The file has a value import from the exact source. |
| `hasTypeImport` | string or `{ name, from? }` | The file imports the named type, optionally from an exact source. |
| `hasTypeImportFrom` | string | The file has a type import from the exact source. |

```json
{
  "paths": "src/{moduleName}.ts",
  "must": [
    {
      "if": {
        "hasValueImport": { "name": "createClient", "from": "./client" }
      },
      "must": { "exportConstants": ["client"] }
    },
    {
      "if": { "hasTypeImportFrom": "./types" },
      "must": { "exportTypes": ["ClientOptions"] }
    }
  ]
}
```

The string form of `hasValueImport` and `hasTypeImport` checks the imported name without constraining its source. For named imports, `name` is the original imported name and local aliases are ignored: `hasValueImport: "createClient"` matches both `import { createClient }` and `import { createClient as createApiClient }`. The condition schema does not accept `alias`.

`from`, `hasValueImportFrom`, and `hasTypeImportFrom` resolve templates, then compare the complete module specifier exactly. Unlike `importValuesFrom` and `importTypesFrom`, condition sources do not support arrays, trailing `/*` selectors, exclusions, or re-inclusions.

Value and type imports remain separate:

| Import declaration | Value condition | Type condition |
| --- | --- | --- |
| `import { value } from "pkg"` | Symbol and source conditions match. | No match. |
| `import type { Type } from "pkg"` | No match. | Symbol and source conditions match. |
| `import { value, type Type } from "pkg"` | Matching value symbol and source conditions match. | Matching type symbol and source conditions match. |
| `import "./setup"` | `hasValueImportFrom` matches. | No match. |

Only static ES import declarations count. Re-exports, dynamic `import()`, `require()`, and TypeScript import-equals do not.

An `if` block has exactly **one** condition property — not multiple and not an empty object.

## `for.files`

Restrict predicates to files matching a sub-pattern within the parent path. The pattern can introduce **new placeholders** that are then available in `must`.

### Single pattern

```json
{
  "paths": "components/{componentName}",
  "must": [
    {
      "for": { "files": "{storyFile}.stories.tsx" },
      "must": { "exportConstants": ["meta"] }
    }
  ]
}
```

For `components/Button`, the block runs once per `*.stories.tsx` file inside `Button/`. The new `storyFile` placeholder is available in `must`.

### Multiple patterns

`files` accepts an array of patterns; the union is matched.

```json
{
  "paths": "modules/{moduleName}",
  "must": [
    {
      "for": { "files": ["*.test.ts", "*.spec.ts"] },
      "must": { "importValues": [{ "name": "createTestContext", "from": "@/test-utils" }] }
    }
  ]
}
```

### Combining `if` and `for`

```json
{
  "if": { "hasFile": "index.test.tsx" },
  "for": { "files": "index.test.tsx" },
  "must": { "importValues": [{ "name": "render", "from": "@/test-utils" }] }
}
```

`if` gates whether the block runs at all; `for` narrows which files inside the matched path the predicates apply to. Common idiom: gate on the existence of a file, then run predicates only on that file.

## `excludeFiles`

Skip specific files — at the convention level or inside a block.

At the convention level:

```json
{
  "name": "plugin-exports",
  "paths": "plugins/{pluginName}/index.ts",
  "excludeFiles": ["plugins/storage/index.ts"],
  "must": {
    "exportValues": ["activate"],
    "exportConstants": ["pluginId"]
  }
}
```

Inside a block:

```json
{
  "for": { "files": "*.spec.ts" },
  "excludeFiles": ["plugins/auth/helpers.spec.ts"],
  "must": { "importValues": [{ "name": "createTestContext", "from": "@/test-utils" }] }
}
```

For broader, pattern-based exclusion (rather than enumerating exceptions), prefer [path negation](./path-patterns.md#negation) in `paths`.

## Block names

The optional `name` field on a block is shown in violation messages alongside the convention name. Useful when one convention has several blocks:

```json
{
  "name": "component-structure",
  "paths": "components/{componentName}",
  "must": [
    { "must": { "haveFiles": ["index.tsx"] } },
    {
      "name": "test-render-helper",
      "if": { "hasFile": "index.test.tsx" },
      "for": { "files": "index.test.tsx" },
      "must": { "importValues": [{ "name": "render", "from": "@/test-utils" }] }
    },
    {
      "name": "story-meta",
      "for": { "files": "*.stories.tsx" },
      "must": { "exportConstants": ["meta"] }
    }
  ]
}
```

A failure in the `test-render-helper` block reports `[component-structure / test-render-helper]` so the user knows exactly which block fired. Block names match `[a-z0-9-]+`.
