# konsistent.json

The `konsistent.json` file declares the structural conventions the CLI enforces. By default it lives at the project root; use `--config-path` to put it elsewhere, or `--config-package <pkg>` to load it from an installed npm package (see [cli.md](./cli.md#flags)).

## Top-level shape

```json
{
  "$schema": "node_modules/konsistent/konsistent.schema.json",
  "version": "v1",
  "kebabToPascalMap": { "openai": "OpenAI" },
  "kebabToCamelMap": { "openai": "openAI" },
  "conventions": [
    {
      "name": "provider-packages",
      "paths": "packages/{providerId}",
      "must": {
        "haveType": "directory",
        "haveFiles": ["src/index.ts"]
      }
    }
  ]
}
```

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `version` | `"v1"` | yes | Configuration version. Currently always `"v1"`. |
| `$schema` | string | no | Path to `konsistent.schema.json` for editor autocomplete. |
| `conventions` | `Convention[]` | yes | Array of convention rules (see below). Each entry can be a hand-written convention, a string reference, or a `use` reference — see [reusable-conventions.md](./reusable-conventions.md). |
| `conventionSources` | `Record<string, string>` | no | Vendor-prefix bindings for reusable convention packages or local JSON files. See [reusable-conventions.md](./reusable-conventions.md). |
| `kebabToPascalMap` | `Record<string, string>` | no | Override default kebab → PascalCase conversion. See [case-maps.md](./case-maps.md). |
| `kebabToCamelMap` | `Record<string, string>` | no | Override default kebab → camelCase conversion. See [case-maps.md](./case-maps.md). |

## Conventions

A convention is a rule that says "files matching `paths` must satisfy `must` and must not satisfy `mustNot`."

```json
{
  "name": "provider-barrels",
  "description": "Each provider package barrel must re-export the provider function",
  "severity": "error",
  "paths": "packages/{providerId}/src/index.ts",
  "must": {
    "export": ["${providerId}"]
  }
}
```

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `paths` | `string` or `string[]` | yes | Glob pattern(s) with `{placeholder}` extraction. See [path-patterns.md](./path-patterns.md). |
| `must` | `MustPredicates` or `MustBlock[]` | yes, unless `mustNot` is present | The conditions that matched paths must satisfy. See [predicates.md](./predicates.md) and [conditional-rules.md](./conditional-rules.md). |
| `mustNot` | `MustPredicates` | yes, unless `must` is present | The conditions that matched paths must not satisfy. Unlike `must`, this only accepts the object form. |
| `name` | string matching `[a-z0-9-]+` | no | Identifier shown in violation reports. |
| `description` | string | no | Human-readable explanation. |
| `severity` | `"error"` \| `"warning"` | no, default `"error"` | See [Severity](#severity). |
| `excludeFiles` | `string[]` | no | Glob patterns to exclude from the matched paths. |
| `placeholders` | `Record<string, string>` | no | Static placeholder values for names that are not captured from `paths`. See [Static placeholder values](./path-patterns.md#static-placeholder-values). |

The configuration is `strict` — unknown fields cause a validation error. Run `konsistent validate` to catch typos.

## `must`: predicates or blocks

`must` accepts two shapes.

### Object form (single predicate group)

```json
"must": {
  "haveType": "directory",
  "haveFiles": ["index.ts"],
  "export": ["createService"]
}
```

All listed predicates apply unconditionally to every matched path. See [predicates.md](./predicates.md) for the full catalog.

### Array form (multiple blocks with conditions)

```json
"must": [
  { "must": { "haveFiles": ["index.ts"] } },
  {
    "if": { "hasFile": "index.test.ts" },
    "for": { "files": "index.test.ts" },
    "must": { "import": [{ "name": "createTestContext", "from": "@/test-utils" }] }
  }
]
```

Each entry is a `MustBlock` that can have `if`, `for`, `excludeFiles`, `name`, and `description`. See [conditional-rules.md](./conditional-rules.md). An entry may alternatively be a reusable-convention reference of the form `{ "use": "<vendor>/<name>", ...overrides }`, which expands into a `MustBlock` — see [reusable-conventions.md](./reusable-conventions.md#use-inside-a-parents-must).

## `mustNot`: negated predicates

`mustNot` accepts the same predicate object shape as object-form `must`, but reverses the result. For example, this fails when a matched file exports `debug`:

```json
"mustNot": {
  "exportConstants": ["debug"]
}
```

`mustNot` is only object-form. It cannot contain a `MustBlock[]`, string references, or `{ "use": ... }` references. Use it inside a `must` block when you need `if`, `for`, or `excludeFiles` scoping.

## Severity

By default, convention violations are errors and produce a non-zero exit code. Mark a convention as a warning with `"severity": "warning"`:

```json
{
  "paths": "packages/{name}/src/index.ts",
  "severity": "warning",
  "must": {
    "exportTypes": ["${name.toPascalCase()}Config"]
  }
}
```

Warnings are displayed in yellow and do not cause a non-zero exit code. The CLI flags [`--error-on-warnings` and `--diagnostic-level`](./cli.md#flags) change how warnings affect the exit code and whether warning-severity conventions are evaluated at all.

## `excludeFiles`

Skip specific files from a convention without changing the path pattern:

```json
{
  "paths": "src/**/*.ts",
  "excludeFiles": ["**/*.test.ts", "src/internal/**"],
  "must": {
    "export": ["default"]
  }
}
```

`excludeFiles` accepts the same glob syntax as `paths`, including `{a,b}` alternation and `[ab]` character classes, but without placeholder extraction: a `{name}` segment is matched literally rather than treated as a capturing wildcard. Path negation in `paths` (`"!path"`) is the inverse; see [path-patterns.md](./path-patterns.md#negation).

## Validation

Run [`konsistent validate`](./cli.md#validate) after every edit to catch schema errors. The schema lives at `node_modules/konsistent/konsistent.schema.json` once the package is installed.
