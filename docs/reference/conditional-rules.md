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
| `if` | `{ hasFile }` or `{ placeholderSatisfies }` | no | Gate. Block runs only if the condition holds. |
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

An `if` block has exactly **one** of `hasFile` or `placeholderSatisfies` — not both, not neither.

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
