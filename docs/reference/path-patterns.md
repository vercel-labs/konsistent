# Path patterns

A convention's `paths` field declares which files or directories it applies to. Path patterns combine glob syntax with **placeholders** that capture parts of the path so they can be referenced inside `must` predicates.

## Glob basics

`paths` accepts a single string or an array of strings. Globs use the standard `*` (single segment), `**` (any depth), `?` (single char), and `{a,b}` (alternation) syntax.

```json
"paths": "src/**/*.ts"
```

```json
"paths": [
  "packages/*/src/index.ts",
  "apps/*/src/main.ts"
]
```

## Placeholders

Wrap a path segment in `{name}` to extract it as a placeholder. The captured value becomes available inside `must` predicates as `${name}`.

```json
{
  "paths": "packages/{pkgName}",
  "must": {
    "haveFiles": ["src/${pkgName}.ts"]
  }
}
```

For a directory `packages/openai`, `pkgName` resolves to `"openai"`, and the rule requires `packages/openai/src/openai.ts`.

A placeholder matches one path segment by default. Use it where a literal value would normally appear:

```json
"paths": "services/{svcName}/index.ts"
```

The same placeholder can appear in both the path and the `must` predicates:

```json
{
  "paths": "packages/{providerId}/src/${providerId}-provider.ts",
  "must": {
    "exportInterfaces": [
      { "name": "${providerId.toPascalCase()}Provider" }
    ]
  }
}
```

## Static placeholder values

Sometimes a placeholder name is used inside `must`, but the consumer's tree has only one concrete value and there's no wildcard segment to capture it from. Use the optional `placeholders` field on the convention to supply the value directly:

```json
{
  "paths": "packages/openai/src/index.ts",
  "placeholders": { "providerId": "openai" },
  "must": {
    "exportFunctions": ["create${providerId.toPascalCase()}Provider"]
  }
}
```

This is equivalent to `paths: "packages/{providerId}/src/index.ts"` when the tree contains exactly one provider folder, but doesn't require a wildcard. It's especially useful when consuming a [reusable convention](./reusable-conventions.md) whose `must` references a placeholder that the local tree doesn't have a wildcard for.

A name may not appear in both a `{name}` placeholder in `paths` and in `placeholders` — pick one source of truth.

You can also inject placeholder values from the command line via the `--placeholder name:value` flag (repeatable). CLI-supplied placeholders are merged into every convention's `placeholders` map and override any existing entries there, which lets you reuse a `konsistent.json` written by someone else without forking it. CLI placeholders may not collide with names captured from `paths` — that's an error.

Values must match the same `[a-zA-Z0-9_-]+` charset as values extracted from paths. All template helpers (`toPascalCase()`, `toCamelCase()`, etc.) work the same way as for captured placeholders.

## Case transformations

Inside `${...}` template substitutions, methods transform the captured value:

| Template | Input → output |
| --- | --- |
| `${name}` or `${name.toString()}` | raw value, e.g. `"my-thing"` |
| `${name.toPascalCase()}` | `my-thing` → `MyThing` |
| `${name.toCamelCase()}` | `my-thing` → `myThing` |
| `${name.toKebabCase()}` | `MyThing` → `my-thing` |
| `${name.toSnakeCase()}` | `MyThing` → `my_thing` |
| `${name.toFlatCase()}` | `my-thing` → `mything` |
| `${name.toNthSegment(0)}` | `my-thing` → `my` (split by `-`, return nth segment) |
| `${name.toNthSegmentPascalCase(1)}` | `my-thing` → `Thing` |
| `${name.toNthSegmentCamelCase(1)}` | `my-thing` → `thing` |
| `${name.extract(regex)}` | `openai` with `^([a-z]+)ai$` → `open` |

`extract` returns the first capture group when the regex has groups; otherwise it returns the full match. An empty string is returned when the regex does not match.

The argument inside `(...)` is taken verbatim — no surrounding quotes. The argument may not contain `}` (use repetition like `\d\d?` instead of `\d{1,2}` if you need quantifiers).

For acronyms like `openai` → `OpenAI` instead of `Openai`, declare overrides with [`kebabToPascalMap`](./case-maps.md).

### Template substitutions in predicates

Templates work anywhere a string appears in `must`:

```json
{
  "paths": "adapters/{adapterName}/factory.ts",
  "must": {
    "exportFunctions": [
      {
        "name": "create${adapterName.toPascalCase()}Adapter",
        "receiveParamOfType": "${adapterName.toPascalCase()}AdapterConfig",
        "returnValueOfType": "${adapterName.toPascalCase()}Adapter"
      }
    ]
  }
}
```

For `adapters/postgres/factory.ts`, the rule requires `createPostgresAdapter` with parameter type `PostgresAdapterConfig` and return type `PostgresAdapter`.

## Path placeholder constraints

Placeholders accept inline constraints with `{name:constraint(arg)}`. Paths whose extracted value fails a constraint are skipped — the rule does not apply.

```json
"paths": "packages/{providerId:matches(^[a-z]+ai$)}/src/${providerId}-stem.ts"
```

For the constraint catalog (`matches`, `segments`), syntax rules, and use in `if.placeholderSatisfies` blocks, see [constraints.md](./constraints.md).

## Negation

Prefix a pattern with `!` to exclude paths matched by other entries. Negation is most useful for known exceptions:

```json
{
  "paths": [
    "packages/{packageName}/src/index.ts",
    "!packages/test-utils/src/index.ts"
  ],
  "must": {
    "export": ["${packageName}"]
  }
}
```

Every package barrel must export a function named after the package, except `test-utils`.

For excluding files based on a sub-pattern within matched paths, see [`excludeFiles`](./configuration.md#excludefiles) on the convention or block.

## Multiple path entries

`paths` as an array runs the rule against the union of all matches:

```json
"paths": [
  "src/components/**/*.tsx",
  "src/widgets/**/*.tsx"
]
```

Combine with negation to compose include/exclude lists.

## Matching files vs. directories

Glob results include both files and directories. Use `haveType` to assert which one is expected:

```json
{
  "paths": "packages/{name}",
  "must": { "haveType": "directory" }
}
```

When the path's last segment ends with a file extension (e.g. `.ts`), only files match. When it ends in a placeholder (e.g. `{name}`) without an extension, both can match — be explicit with `haveType` or narrow the pattern (`packages/{name}/`).
