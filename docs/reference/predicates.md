# Predicates

Predicates are the assertions inside a convention's `must` or `mustNot` block. Each predicate checks one structural property of the matched path. Listing multiple predicates in the same `must` is equivalent to AND — they all must pass. Listing predicates in `mustNot` reverses the result — a matched path fails when it satisfies one of those predicates.

The full machine-readable schema lives at `node_modules/konsistent/konsistent.schema.json`.

## Catalog

- [Filesystem predicates](#filesystem-predicates)
  - [`haveType`](#havetype)
  - [`haveFiles`](#havefiles)
- [Declaration predicates](#declaration-predicates)
  - [`declareTypes`](#declaretypes)
  - [`declareConstants`](#declareconstants)
  - [`declareFunctions`](#declarefunctions)
  - [`declareInterfaces`](#declareinterfaces)
  - [`declareClasses`](#declareclasses)
- [Export predicates](#export-predicates)
  - [`exportValues`](#exportvalues)
  - [`exportTypes`](#exporttypes)
  - [`exportConstants`](#exportconstants)
  - [`exportFunctions`](#exportfunctions)
  - [`exportInterfaces`](#exportinterfaces)
  - [`exportClasses`](#exportclasses)
- [Import predicates](#import-predicates)
  - [`importValues`](#importvalues)
  - [`importTypes`](#importtypes)
  - [`importValuesFrom`](#importvaluesfrom)
  - [`importTypesFrom`](#importtypesfrom)
  - [`importValuesFromCurrentDir`](#importvaluesfromcurrentdir)
  - [`importValuesFromParents`](#importvaluesfromparents)
  - [`importValuesFromExternals`](#importvaluesfromexternals)
  - [`importTypesFromCurrentDir`](#importtypesfromcurrentdir)
  - [`importTypesFromParents`](#importtypesfromparents)
  - [`importTypesFromExternals`](#importtypesfromexternals)
- [Structural predicates](#structural-predicates)
  - [`useDeclarationOrder`](#usedeclarationorder)
  - [`areBarrelFiles`](#arebarrelfiles)

All predicates support template substitutions in their string values — see [path-patterns.md](./path-patterns.md#case-transformations) for the full case-transformation catalog.

`mustNot` accepts only the object form:

```json
"mustNot": {
  "exportConstants": ["debug"]
}
```

It does not accept `MustBlock[]` or reusable-convention references.

---

## Filesystem predicates

### `haveType`

Assert that the matched path is a file or a directory.

```json
"must": { "haveType": "directory" }
```

```json
"must": { "haveType": "file" }
```

Values: `"file"` or `"directory"`.

Use this when a glob pattern could match either (e.g., `packages/{name}` could match a file or directory) and you want to be explicit.

### `haveFiles`

Assert that specific files exist within the matched path. Used with directory paths.

```json
{
  "paths": "packages/{providerId}",
  "must": {
    "haveType": "directory",
    "haveFiles": ["src/index.ts", "src/${providerId}-provider.ts"]
  }
}
```

For `packages/openai`, this requires both `packages/openai/src/index.ts` and `packages/openai/src/openai-provider.ts` to exist. Templates resolve from the parent path placeholders.

`haveFiles` paths are relative to the matched directory and may contain forward slashes for nested paths.

---

## Declaration predicates

Declaration predicates assert local declarations that must not be exported. They mirror the kind-specific export predicates, but expect declarations such as `const value = ...` or `function createValue() {}` instead of `export const value = ...`.

All declaration predicates accept an array of bare strings or objects with a `name` field. The string form is shorthand for `{ "name": "<value>" }`.

### `declareTypes`

Assert local type declarations. Interfaces and type aliases qualify. An object
entry can use `schema` to validate the local definition using the same supported
shapes and declaration semantics as `exportTypes`.

```json
"must": {
  "declareTypes": [
    {
      "name": "InternalConfig",
      "schema": {
        "type": "object",
        "properties": { "enabled": { "type": "boolean" } }
      }
    }
  ]
}
```

### `declareConstants`

Assert local `const` declarations. Optionally validate an explicit type
annotation using the same `schema` field as `exportConstants`.

```json
"must": {
  "declareConstants": [
    { "name": "DEFAULT_PORT", "schema": { "type": "number" } }
  ]
}
```

### `declareFunctions`

Assert local function declarations. Optionally validate parameters and return type, using the same fields as `exportFunctions`.

```json
"must": {
  "declareFunctions": [
    {
      "name": "createInternalClient",
      "receiveParamsOfTypes": ["ClientConfig"],
      "returnValueOfType": "Client"
    }
  ]
}
```

### `declareInterfaces`

Assert local interface declarations. Optionally validate `extends`, using the same fields as `exportInterfaces`.

```json
"must": {
  "declareInterfaces": [
    { "name": "InternalClient", "extend": "BaseClient" }
  ]
}
```

### `declareClasses`

Assert local class declarations. Optionally validate `extends` and `implements`, using the same fields as `exportClasses`.

```json
"must": {
  "declareClasses": [
    {
      "name": "InternalClient",
      "extend": "BaseClient",
      "implement": ["Disposable"]
    }
  ]
}
```

---

## Export predicates

All export predicates accept an array of either:
- A bare string (the expected export name), or
- An object with a `name` field plus optional metadata.

The string form is shorthand for `{ "name": "<value>" }`.

### `exportValues`

Assert named value exports — anything that is not syntactically type-only. Functions, classes, constants, and re-exported values all qualify.

```json
"must": { "exportValues": ["myFunction", "${name}"] }
```

```json
"must": {
  "exportValues": [
    { "name": "${providerId}", "from": "./${providerId}-provider" }
  ]
}
```

| Field | Type | Description |
| --- | --- | --- |
| `name` | string | The export name. Templates allowed. |
| `from` | string | Optional. If set, the export must come from a re-export pointing at this module specifier. |

When `from` is omitted, only the export's existence is checked. When `from` is set, the export must be a re-export from that source — useful for enforcing barrel-file structure.

### `exportTypes`

Assert type-only exports. Exported type aliases and interfaces qualify. Use
`from` to require a re-export, or use `schema` to validate a locally defined
exported type.

```json
"must": {
  "exportTypes": ["${name.toPascalCase()}Config"]
}
```

```json
"must": {
  "exportTypes": [
    {
      "name": "${providerId.toPascalCase()}Provider",
      "from": "./${providerId}-provider"
    }
  ]
}
```

```json
"must": {
  "exportTypes": [
    {
      "name": "ModuleSettings",
      "schema": {
        "type": "object",
        "properties": {
          "model": { "type": "string" },
          "timeout": { "type": "number" }
        }
      }
    }
  ]
}
```

| Field | Type | Description |
| --- | --- | --- |
| `name` | string | The type name. Templates allowed. |
| `from` | string | Optional. Require a type re-export from this module specifier. |
| `schema` | object | Optional. Validate a locally declared type definition. |

`from` and `schema` are mutually exclusive. Schema validation never resolves a
type definition from another file. The `schema` field supports the same forms
and declaration semantics documented under [`exportConstants`](#exportconstants).

### `exportConstants`

Assert `const` exports specifically. Stricter than `exportValues` — a `function` or `let` with the right name will not satisfy this predicate. An object entry can use `schema` to validate the constant's explicit type annotation.

```json
"must": {
  "exportConstants": [
    "pluginId",
    {
      "name": "mode",
      "schema": {
        "type": "string",
        "enum": ["development", "production"]
      }
    },
    {
      "name": "tags",
      "schema": {
        "type": "array",
        "items": { "type": "string" }
      }
    },
    {
      "name": "options",
      "schema": {
        "type": "object",
        "properties": {
          "endpoint": { "type": "string" },
          "metadata": {}
        },
        "required": ["endpoint"],
        "additionalProperties": false
      }
    }
  ]
}
```

| Field | Type | Description |
| --- | --- | --- |
| `name` | string | The constant name. Templates allowed. |
| `schema` | object | Optional. Supported JSON Schema subset for the constant's explicit type annotation. |

The supported `schema` forms are:

- Scalar: `{ "type": "string" }`, using `string`, `number`, `boolean`, or `null`.
- Enum: `{ "type": "string", "enum": ["a", "b"] }`. The annotation must contain exactly the configured literal values, although their order does not matter.
- Array: `{ "type": "array", "items": { "type": "string" } }`. Items must use a scalar schema. `T[]`, `Array<T>`, `readonly T[]`, and `ReadonlyArray<T>` annotations qualify.
- Object: `{ "type": "object", "properties": { ... }, "required": [...], "additionalProperties": false }`. Every configured property must be declared. An empty property schema (`{}`) checks its presence and optionality without constraining its type; a scalar schema also checks its type.

Object schemas describe TypeScript declaration shapes rather than ordinary JSON Schema instances. Every name in `properties` must exist in the annotation or definition. Names listed in `required` must be non-optional (`name: Type`); all other configured names must be optional (`name?: Type`). `required` defaults to an empty array. `additionalProperties` defaults to `true`, allowing unconfigured TypeScript properties; set it to `false` to reject them.

This is deliberately a strict subset of JSON Schema. Unsupported keywords and shapes are rejected during configuration validation, including `integer`, `$ref`, combinators, nested object or array schemas, tuple schemas, enum array items, schema-valued `additionalProperties`, and constraints such as `minItems`.

Constant schema checks require an explicit annotation on a locally declared constant. Type schema checks require a local type alias or interface definition; interfaces with `extends` are unsupported. Inferred types, named type references, tuples, intersections, index signatures, methods, computed properties, nested types, inherited properties, and cross-file re-exports are not resolved. Enum values and property names inside `schema` are literal data and do not expand placeholders.

### `exportFunctions`

Assert function exports. Optionally validate parameters and return type.

```json
"must": {
  "exportFunctions": [
    {
      "name": "create${serviceName.toPascalCase()}Service",
      "receiveParamsOfTypes": ["${serviceName.toPascalCase()}Config"],
      "returnValueOfType": "${serviceName.toPascalCase()}Service"
    }
  ]
}
```

| Field | Type | Description |
| --- | --- | --- |
| `name` | string | The function name. Templates allowed. |
| `receiveParamsOfTypes` | string[] | Optional. Ordered parameter types to enforce by index. Extra function parameters are allowed. |
| `receiveParamOfType` | string | Deprecated. Optional type at least one parameter must have. Use `receiveParamsOfTypes` instead. |
| `returnValueOfType` | string | Optional. Type the return value must have. |

The bare-string form (`"exportFunctions": ["myFunction"]`) checks existence only.

### `exportInterfaces`

Assert interface exports. Optionally validate the `extends` clause.

```json
"must": {
  "exportInterfaces": [
    { "name": "${providerId.toPascalCase()}Provider", "extend": "ProviderV1" }
  ]
}
```

```json
"must": {
  "exportInterfaces": [
    {
      "name": "${providerId.toPascalCase()}Provider",
      "extend": { "type": "ProviderV1", "allowOmissions": true }
    }
  ]
}
```

| Field | Type | Description |
| --- | --- | --- |
| `name` | string | The interface name. Templates allowed. |
| `extend` | string \| `{ type, allowOmissions? }` | Optional. Base interface the interface must extend. |

When `extend` is the object form with `allowOmissions: true`, the interface satisfies the rule even if it extends a generic variant or partial of the base type — useful when implementations omit optional members.

### `exportClasses`

Assert class exports. Optionally validate `extends` and `implements` clauses.

```json
"must": {
  "exportClasses": [
    {
      "name": "${adapterName.toPascalCase()}Adapter",
      "extend": "BaseAdapter",
      "implement": ["Connectable", "Disposable"]
    }
  ]
}
```

| Field | Type | Description |
| --- | --- | --- |
| `name` | string | The class name. Templates allowed. |
| `extend` | string \| `{ type, allowOmissions? }` | Optional. Base class the class must extend. |
| `implement` | array of (string \| `{ type, allowOmissions? }`) | Optional. Interfaces the class must implement. |

`allowOmissions` works the same as in `exportInterfaces` — relax the contract when the class extends or implements a generic variant.

---

## Import predicates

### `importValues`

Assert named value imports.

```json
"must": {
  "importValues": [
    { "name": "useState", "from": "react" }
  ]
}
```

| Field | Type | Description |
| --- | --- | --- |
| `name` | string | The imported binding. Templates allowed. |
| `from` | string | Optional. Module specifier the import must come from. |

Bare-string form (`"importValues": ["useState"]`) checks the binding regardless of source.

### `importValuesFrom`

Assert that the file has at least one value import from a specific module specifier. Side-effect imports such as `import "./setup"` count as value imports; imports containing only type bindings do not.

```json
"must": { "importValuesFrom": "react" }
```

```json
"must": { "importValuesFrom": ["./setup", "package/*"] }
```

The value is a string or an array of strings. Independent array entries are additive: every entry must be satisfied in `must`, and every entry is forbidden in `mustNot`.

By default, entries match exactly. For example, `"package"` only matches `import ... from "package"` and does not match `import ... from "package/v4"`.

Use a trailing `/*` to select import sources below a prefix:

- `"@vendor/*"` matches every package from that vendor, including package sub-entrypoints such as `"@vendor/project/testing"`.
- `"package/*"` matches unvendored package entrypoints such as `"package/v4"`, but not the package root `"package"`.
- `"@vendor/package/*"` matches vendored package entrypoints such as `"@vendor/package/testing"`, but not the package root `"@vendor/package"`.

Other wildcard positions are invalid.

Within an array, negate part of a wildcard selector by prefixing a nested pattern with `!`:

```json
"must": {
  "importValuesFrom": [
    "react",
    "zod",
    "@ai-sdk/*",
    "!@ai-sdk/harness"
  ]
}
```

This requires imports from `"react"`, `"zod"`, and any package from the `@ai-sdk` vendor except the exact `"@ai-sdk/harness"` package. The exact exclusion does not exclude harness entrypoints; use `"!@ai-sdk/harness/*"` to exclude those as well.

Re-include a more specific part of an excluded wildcard branch with another positive pattern:

```json
"mustNot": {
  "importValuesFrom": [
    "@ai-sdk/*",
    "!@ai-sdk/harness",
    "!@ai-sdk/harness/*",
    "@ai-sdk/harness/bridge"
  ]
}
```

This forbids imports from the `@ai-sdk` vendor, allows the harness package and its entrypoints, then forbids the exact bridge entrypoint again. `must` uses the same selected set but requires at least one matching import instead.

Selector rules must be strictly nested and must change the preceding selector. Dangling or unrelated exclusions, redundant re-inclusions, and overlapping independent entries are invalid configurations. For example, `"@ai-sdk/react"` cannot be combined as an independent requirement with `"@ai-sdk/*"`.

### `importTypes`

Assert named type imports, whether they use `import type { ... } from` or inline `type` specifiers.

```json
"must": {
  "importTypes": [
    { "name": "ProviderV1", "from": "@ai-toolkit/core" }
  ]
}
```

Same shape as `importValues`. Useful for enforcing dependency direction — every adapter's implementation file must `import type` its base from a specific module.

### `importTypesFrom`

Assert that the file has at least one type import from a specific module specifier.

```json
"must": { "importTypesFrom": ["./types", "@scope/package/*"] }
```

It uses the same additive array behavior, trailing `/*` selectors, exclusions, and nested re-inclusions as `importValuesFrom`. Value-only and side-effect imports do not count. A mixed statement such as `import { value, type Options } from "./module"` satisfies both `importValuesFrom` and `importTypesFrom`.

### `importValuesFromCurrentDir`

Assert whether the file has value imports from the current directory via `./...`.

```json
"must": { "importValuesFromCurrentDir": true }
```

`true` requires at least one value import whose module specifier is `"."` or starts with `"./"`. `false` forbids those imports. Imports containing only type bindings are ignored. Side-effect imports such as `import "./setup"` count as value imports.

### `importValuesFromParents`

Assert whether the file has value imports from parent directories via `../...`.

```json
"must": { "importValuesFromParents": false }
```

`true` requires at least one value import whose module specifier is `".."` or starts with `"../"`. `false` forbids those imports. Imports containing only type bindings are ignored.

### `importValuesFromExternals`

Assert whether the file has value imports from external module specifiers.

```json
"must": { "importValuesFromExternals": true }
```

`true` requires at least one value import that is not `./...` or `../...`. `false` forbids those imports. Scoped packages, `node:` modules, and unresolved path aliases such as `@/utils` count as external because `konsistent` does not resolve module aliases. Imports containing only type bindings are ignored.

### `importTypesFromCurrentDir`

Assert whether the file has type imports from the current directory via `./...`.

```json
"must": { "importTypesFromCurrentDir": true }
```

`true` requires at least one type import whose module specifier is `"."` or starts with `"./"`. `false` forbids those imports. Imports containing only value bindings are ignored.

### `importTypesFromParents`

Assert whether the file has type imports from parent directories via `../...`.

```json
"must": { "importTypesFromParents": false }
```

`true` requires at least one type import whose module specifier is `".."` or starts with `"../"`. `false` forbids those imports. Imports containing only value bindings are ignored.

### `importTypesFromExternals`

Assert whether the file has type imports from external module specifiers.

```json
"must": { "importTypesFromExternals": true }
```

`true` requires at least one type import that is not `./...` or `../...`. `false` forbids those imports. Scoped packages, `node:` modules, and unresolved path aliases such as `@/utils` count as external because `konsistent` does not resolve module aliases. Imports containing only value bindings are ignored.

---

## Structural predicates

### `useDeclarationOrder`

Assert relative order for selected symbols.

```json
"must": {
  "useDeclarationOrder": ["schema", "parseInput", "formatOutput"]
}
```

The configured array is the expected order. Only symbols that are present in the file are checked; missing symbols do not produce diagnostics. Local declarations and named exports/re-exports are considered. Default exports and `export * from ...` are ignored.

### `areBarrelFiles`

Assert that the matched files are pure barrel files: every top-level statement must be a re-export of another module, not a local declaration.

```json
{
  "paths": "src/{moduleName}",
  "must": [
    {
      "for": { "files": "index.ts" },
      "must": { "areBarrelFiles": true }
    }
  ]
}
```

A file passes when every top-level statement is one of:

- An `import` declaration of any form, including bare side-effect imports (`import "./polyfill"`).
- A re-export with a module specifier: `export * from "./x"`, `export * as ns from "./x"`, `export { a, b as c } from "./x"`, `export { default } from "./x"`, `export { default as Foo } from "./x"`.
- `export { a, b as c }` where every specifier references an identifier brought in by an `import` statement in the same file. Aliasing (`as`) is allowed because it is a pure re-export.
- `export default <Identifier>` where the identifier was brought in by an `import` statement in the same file.

Every other top-level construct produces a diagnostic:

| Violation kind | Example | Message |
| --- | --- | --- |
| `declaration` | `const x = 1;`, `function f() {}`, `class C {}`, `enum E {}`, `type T = ...`, `interface I {}` | `Barrel file must not contain declarations` |
| `expression` | `doSomething();` | `Barrel file must not contain top-level expression statements` |
| `default-expression` | `export default { a: 1 };`, `export default 42;` | `Barrel file default export must re-export an imported identifier` |
| `named-export-local` | `const x = 1; export { x };` | `Barrel file must only re-export imported identifiers` |
| `export-equals` | `export = x;` | <code>Barrel file must not use &#96;export =&#96;</code> |

The predicate takes a bare boolean (`true` enables, `false`/omitted disables). It does not enforce a filename — pair it with a `for` block or a `paths` pattern that targets the files you consider barrels.

---

## Composing predicates

Multiple predicates in the same `must` are AND-ed:

```json
"must": {
  "haveType": "file",
  "exportValues": ["createService"],
  "exportTypes": ["ServiceConfig"],
  "importTypes": [{ "name": "ServiceBase", "from": "../base" }]
}
```

For OR-style logic (apply different predicates to different files), use [conditional rules](./conditional-rules.md) — the array form of `must` with `if`/`for` blocks.

Note that **reusable conventions** (those published via `@konsistent/convention` and consumed via `conventionSources`) are restricted to flat object-form `must` and `mustNot` predicates — the `MustBlock[]` form is unavailable on the author side. Hand-written conventions in your own `konsistent.json` can still use `MustBlock[]` in `must`. See [reusable-conventions.md](./reusable-conventions.md#restrictions).
