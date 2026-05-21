# Predicates

Predicates are the assertions inside a convention's `must` block. Each predicate checks one structural property of the matched path. Listing multiple predicates in the same `must` is equivalent to AND — they all must pass.

The full machine-readable schema lives at `node_modules/konsistent/konsistent.schema.json`.

## Catalog

- [Filesystem predicates](#filesystem-predicates)
  - [`haveType`](#havetype)
  - [`haveFiles`](#havefiles)
- [Export predicates](#export-predicates)
  - [`export`](#export)
  - [`exportTypes`](#exporttypes)
  - [`exportConstants`](#exportconstants)
  - [`exportFunctions`](#exportfunctions)
  - [`exportInterfaces`](#exportinterfaces)
  - [`exportClasses`](#exportclasses)
- [Import predicates](#import-predicates)
  - [`import`](#import)
  - [`importTypes`](#importtypes)
- [Structural predicates](#structural-predicates)
  - [`areBarrelFiles`](#arebarrelfiles)

All predicates support template substitutions in their string values — see [path-patterns.md](./path-patterns.md#case-transformations) for the full case-transformation catalog.

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

## Export predicates

All export predicates accept an array of either:
- A bare string (the expected export name), or
- An object with a `name` field plus optional metadata.

The string form is shorthand for `{ "name": "<value>" }`.

### `export`

Assert named value exports — anything that is not a type-only export. Functions, classes, constants, and re-exported values all qualify.

```json
"must": { "export": ["myFunction", "${name}"] }
```

```json
"must": {
  "export": [
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

Assert type-only exports. Both `export type X` and `export interface X` (when exported as a type via `export type { ... }`) match.

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

Same shape as `export`: bare string or `{ name, from? }`.

### `exportConstants`

Assert `const` exports specifically. Stricter than `export` — a `function` or `let` with the right name will not satisfy this predicate.

```json
"must": {
  "exportConstants": ["pluginId", "DEFAULT_CONFIG"]
}
```

| Field | Type | Description |
| --- | --- | --- |
| `name` | string | The constant name. Templates allowed. |

### `exportFunctions`

Assert function exports. Optionally validate the parameter and return type.

```json
"must": {
  "exportFunctions": [
    {
      "name": "create${serviceName.toPascalCase()}Service",
      "receiveParamOfType": "${serviceName.toPascalCase()}Config",
      "returnValueOfType": "${serviceName.toPascalCase()}Service"
    }
  ]
}
```

| Field | Type | Description |
| --- | --- | --- |
| `name` | string | The function name. Templates allowed. |
| `receiveParamOfType` | string | Optional. Type the first parameter must have. |
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

### `import`

Assert named value imports.

```json
"must": {
  "import": [
    { "name": "useState", "from": "react" }
  ]
}
```

| Field | Type | Description |
| --- | --- | --- |
| `name` | string | The imported binding. Templates allowed. |
| `from` | string | Optional. Module specifier the import must come from. |

Bare-string form (`"import": ["useState"]`) checks the binding regardless of source.

### `importTypes`

Assert type-only imports (`import type { ... } from`).

```json
"must": {
  "importTypes": [
    { "name": "ProviderV1", "from": "@ai-toolkit/core" }
  ]
}
```

Same shape as `import`. Useful for enforcing dependency direction — every adapter's implementation file must `import type` its base from a specific module.

---

## Structural predicates

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
  "export": ["createService"],
  "exportTypes": ["ServiceConfig"],
  "importTypes": [{ "name": "ServiceBase", "from": "../base" }]
}
```

For OR-style logic (apply different predicates to different files), use [conditional rules](./conditional-rules.md) — the array form of `must` with `if`/`for` blocks.

Note that **reusable conventions** (those published via `@konsistent/convention` and consumed via `conventionSources`) are restricted to the flat object form of `must` — the `MustBlock[]` form is unavailable on the author side. Hand-written conventions in your own `konsistent.json` retain the full surface area. See [reusable-conventions.md](./reusable-conventions.md#restrictions).
