# Conditional rules

`if` and `ifNot` conditions can gate either a block inside a convention's `must` array or an entire reusable convention referenced at the top level. This unlocks rules like "story files must export `meta`" or "test files must import the project's custom render helper" — structural conventions that linters and the type checker won't catch on their own.

## Top-level conditions on reusable references

A reusable convention can declare `if`, `ifNot`, or both, and a top-level object reference can override either condition:

```json
{
  "use": "common/conditionally-require-tests",
  "paths": "packages/{packageName}",
  "if": { "hasFile": "${packageName}.test.ts" },
  "ifNot": { "hasFile": "skip-tests.ts" }
}
```

For each path matched by `paths`, the conditions are resolved with that path's placeholders and evaluated independently. A failed gate skips every `must` and `mustNot` predicate or block for that path. A match continues with normal predicate execution, including each block's own conditions and `for` behavior. A use-site `if` or `ifNot` replaces the corresponding inherited condition as one complete object rather than merging condition properties.

This top-level form is specific to reusable-convention references; hand-written conventions continue to put conditions inside `must` blocks. See [Reusable conventions](./reusable-conventions.md).

## Positive and negative gates

`if` and `ifNot` accept the same single-predicate objects and condition sets. Both use the same predicate evaluator. `ifNot` reverses each predicate's result before combining results, rather than reversing the combined result. Adding support for a predicate automatically makes it available through both fields.

| Fields present | The rule runs when |
| --- | --- |
| neither | Always. |
| `if` | The positive gate passes. |
| `ifNot` | The negative gate passes. |
| both | Both gates pass independently. |

## Condition sets

To combine predicates inside one gate, use a nonempty `conditions` array and an optional `operator`. The operator defaults to `"and"`; `"or"` is also supported. Existing single-predicate objects remain valid.

```json
{
  "paths": "modules/{moduleName}",
  "must": [
    {
      "if": {
        "conditions": [
          { "hasFile": "index.ts" },
          { "hasDirectory": "tests" }
        ]
      },
      "ifNot": {
        "operator": "or",
        "conditions": [
          { "hasFile": "skip-tests.ts" },
          { "hasFile": "legacy.ts" }
        ]
      },
      "must": { "haveFiles": ["tests/index.test.ts"] }
    }
  ]
}
```

This block runs when `index.ts` and the `tests` directory exist, and at least one of `skip-tests.ts` or `legacy.ts` is absent.

| Field | Operator | Gate passes when |
| --- | --- | --- |
| `if` | `and` (default) | Every predicate is true. |
| `if` | `or` | At least one predicate is true. |
| `ifNot` | `and` (default) | Every predicate is false. |
| `ifNot` | `or` | At least one predicate is false. |

For example, `ifNot` with AND means `!A && !B`, not `!(A && B)`. A one-entry set behaves exactly like its single-predicate object. Predicates are evaluated in array order and stop once the gate result is determined.

Each array entry must contain exactly one supported predicate. Repeated predicate kinds are allowed, such as two `hasFile` checks. Empty arrays, nested sets, bare arrays, unknown fields, and mixing `conditions` with predicate properties are rejected. `operator` is only valid alongside `conditions`, not on an individual predicate or its enclosing block.

Sets work wherever conditions are already supported, including reusable conventions and their overrides. With `for.files`, the complete set uses each selected file's context independently. All entries are checked for undeclared placeholders when loading the config, including entries runtime evaluation might skip.

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
  "ifNot": { "hasFile": "skip-tests.ts" },
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
| `if` | predicate object or condition set | no | Positive gate. See [Condition sets](#condition-sets) for combination rules. |
| `ifNot` | predicate object or condition set | no | Negative gate. Inverts each predicate before combination. |
| `for` | `{ files: string \| string[] }` | no | Scope. Conditions and predicates apply to files matching this pattern within the parent path. |
| `excludeFiles` | `string[]` | no | Glob patterns to exclude from the block. |
| `name` | string matching `[a-z0-9-]+` | no | Identifier shown in violation reports. |
| `description` | string | no | Human-readable explanation. |

## Condition predicates for `if` and `ifNot`

Every predicate in this section is available through both `if` and `ifNot`. The predicate determines whether the condition matches; the containing field determines whether that result is used directly or reversed.

### `hasFile`

The condition matches when its value resolves to an existing path or when at least one file matches its glob pattern, relative to the condition context. Templates are resolved using the context's placeholders before matching. Globs support `*`, `**`, `?`, brace alternation such as `*.{md,ts}`, and character classes such as `[ab]`. Use the same object under `ifNot` to run only when there is no match. Literal paths continue to use exact-path existence checks. Unlike `paths`, this predicate does not support negated glob patterns.

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

For an alternative-file requirement, use a glob under `ifNot` to require another glob when no root file matches:

```json
{
  "paths": "modules/{module}",
  "must": [
    {
      "ifNot": { "hasFile": "instructions.{md,ts}" },
      "must": { "haveFiles": ["instructions/*.{md,ts}"] }
    }
  ]
}
```

### `hasDirectory`

The condition matches when its value resolves to an existing directory or when at least one directory matches its glob pattern, relative to the condition context. A file never satisfies `hasDirectory`, even when its name matches the pattern. Templates resolve before matching. Patterns support `*`, `**`, `?`, brace alternation, and character classes; negated glob patterns are not supported. The same condition works under `ifNot` to run when no matching directory exists.

```json
{
  "paths": "modules/{module}",
  "must": [
    {
      "ifNot": { "hasDirectory": "instructions.{md,ts}" },
      "must": { "haveDirectories": ["instructions/*.{md,ts}"] }
    }
  ]
}
```

This requires an `instructions.md` or `instructions.ts` directory at the module root or at least one matching directory inside `instructions/`.

### `placeholderSatisfies`

The condition matches only when the named placeholder satisfies a constraint. Under `ifNot`, the gate passes when the placeholder does not satisfy it. Syntax, constraint catalog, and examples are in [constraints.md](./constraints.md#matchesregex).

### Import predicates

Import conditions inspect the file represented by the condition context. Without `for.files`, that is the path matched by `paths`; with `for.files`, the condition is evaluated separately for each matched file. They return false when the context path is a directory. Parsing is shared with block conditions and TypeScript predicates for the same file.

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

Each single-predicate object, whether used directly or inside a [condition set](#condition-sets), has exactly **one** condition property. Multiple predicate properties and empty objects are not supported.

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

### Combining conditions and `for`

```json
{
  "if": { "hasFile": "index.test.tsx" },
  "for": { "files": "index.test.tsx" },
  "must": { "importValues": [{ "name": "render", "from": "@/test-utils" }] }
}
```

Without `for`, `if` and `ifNot` gate the block using the parent matched path. With `for`, the block first finds matching files, then evaluates the conditions independently for each file; a failed condition skips only that file. The same per-file context is used for the block's predicates. Common idiom: select optional files with `for`, then gate each file on its imports.

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
