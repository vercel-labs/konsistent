# Reusable conventions

Reusable conventions let a `konsistent.json` consume conventions published by another package or shared from a sibling repo, instead of restating every rule in full. A reusable convention is a JSON record produced by an author, bound to a local **vendor prefix** in the consumer's config, and referenced from `conventions[]` either as a string or as an object with overrides.

This page is the consumer-facing reference. To publish your own reusable conventions, see [the authoring guide](../guides/authoring-reusable-conventions.md).

## When to use

- A library author ships a curated set of conventions that consumers of the library should adopt.
- An organization shares an internal "house style" set of conventions across many repos.
- A monorepo wants one canonical set of conventions reused across packages.

For any of those cases, the consumer adds one entry to `conventionSources` and references each convention by name.

## `conventionSources`

`conventionSources` is a top-level field in `konsistent.json`. Each key is a local **vendor prefix** (matches `[a-z0-9-]+`); each value is auto-detected as either a path or an npm specifier:

| Value starts with | Interpretation |
| --- | --- |
| `.` or `/` | Relative path to a JSON file. Resolved against the config file's directory (not `process.cwd()`). |
| Anything else | npm package name. Resolved via the package's `exports["./konsistent"]` condition. |

The vendor prefix is local to your config — you can bind any prefix to any source. Two configs in the same monorepo can pick different prefixes for the same upstream package without conflict.

```json
{
  "$schema": "node_modules/konsistent/konsistent.schema.json",
  "version": "v1",
  "conventionSources": {
    "common": "@konsistent/common-conventions",
    "shared": "./shared/conventions.json"
  },
  "conventions": []
}
```

`conventionSources` is optional. Existing configs without it keep working unchanged.

## Referencing a convention

Each entry of `conventions[]` is one of three shapes. The first two are new for reusable conventions; the third is the existing hand-written form.

### String reference

A bare string `"<vendor>/<name>"` inlines the named reusable convention as-is. The reusable convention must declare its own `paths` — string references cannot supply them. If the convention has no `paths`, `konsistent` fails at config load and tells you to switch to the `use` form.

```json
{
  "version": "v1",
  "conventionSources": {
    "common": "@konsistent/common-conventions"
  },
  "conventions": [
    "common/package-dir-must-have-readme-file"
  ]
}
```

### Object reference (`use` form)

`{ "use": "<vendor>/<name>", ...overrides }` references a reusable convention and overlays your overrides on top of it. The override fields available are `paths`, `placeholders`, `excludeFiles`, `severity`, `if`, `for`, `must`, and `mustNot` — the same optional fields a hand-written convention has, minus `name` and `description` (which come from the source).

Use this form when the reusable convention has no `paths` (so you must supply them) or when you want to adjust a field for your project.

```json
{
  "version": "v1",
  "conventionSources": {
    "common": "@konsistent/common-conventions"
  },
  "conventions": [
    {
      "use": "common/file-must-export-equivalent-component-function",
      "paths": ["src/components/{componentName}.tsx"]
    },
    {
      "use": "common/every-ts-file-must-have-tests",
      "excludeFiles": ["**/*.spec.ts", "src/legacy/**"]
    }
  ]
}
```

When a reusable convention's `must` references a placeholder (e.g. `${providerId}`) and your project has only a single concrete value rather than a wildcard segment, supply it via `placeholders`:

```json
{
  "use": "common/provider-barrel",
  "paths": "packages/openai/src/index.ts",
  "placeholders": { "providerId": "openai" }
}
```

See [Static placeholder values](./path-patterns.md#static-placeholder-values) for the full rules.

### Hand-written convention

Any entry that is neither a string nor has a `use` key is treated as a hand-written `Convention` and validated against the existing schema. See [configuration.md](./configuration.md). You can mix all three forms in the same `conventions[]` array.

### `use` inside a parent's `must[]`

A hand-written convention whose `must` is a `MustBlock[]` may also reference a reusable convention from inside the array, in either the bare-string or the object (`use`) form. Both expand into a single `MustBlock` rather than a full `Convention`. The bare-string form does not require the source convention to declare `paths` (a top-level requirement only) — `paths` belongs to the parent convention.

```json
{
  "version": "v1",
  "conventionSources": {
    "common": "./local-conventions.json"
  },
  "conventions": [
    {
      "name": "component-folder-shape",
      "paths": ["src/components/{componentName}"],
      "must": [
        { "must": { "haveType": "directory" } },
        { "use": "common/must-have-index" }
      ]
    }
  ]
}
```

Allowed override keys at this nesting level are every field a hand-written `MustBlock` exposes — `name`, `description`, `if`, `for`, `excludeFiles`, `must`, and `mustNot`. Top-level-only fields (`paths`, `severity`) are not accepted at the use-site, and the referenced reusable convention must not declare them either: a reusable that ships `paths` or `severity` can only be referenced from the top level of `conventions[]`. Authors who want their reusable to be usable in both contexts should publish it without those fields.

Override merge follows the same rules as the top-level `use` form: arrays replace, primitives replace, and `must`/`mustNot` deep-merge with the inherited predicates.

## Merge semantics

When you write `{ use: "<vendor>/<name>", ...overrides }`, `konsistent` deep-merges your overrides on top of the reusable convention with these rules:

| Field kind | Rule |
| --- | --- |
| Plain object (e.g. `must`, `mustNot`, nested predicate definitions) | Recursive deep-merge. Keys you supply replace the inherited value; keys you omit pass through. |
| Array (e.g. `paths`, `excludeFiles`, predicate lists like `haveFiles`, `declareFunctions`, `exportValues`, `exportFunctions`) | Your array fully replaces the inherited array. Use `"excludeFiles": []` to clear an inherited list. |
| Primitive (e.g. `severity`, `description`) | Your value replaces the inherited value. |

Arrays replace rather than concatenate so you can subtract from a shared convention, not just append. If you want to extend an inherited array, copy it into your override and add to it.

### Before / overrides / after

Given this reusable convention:

```json
{
  "name": "every-ts-file-must-have-tests",
  "description": "Every TypeScript file in src/ ...",
  "paths": ["src/{name:matches(^[^.]+$)}.ts"],
  "excludeFiles": ["legacy.ts"],
  "must": {
    "haveFiles": ["${name}.test.ts"]
  }
}
```

And this consumer entry:

```json
{
  "use": "common/every-ts-file-must-have-tests",
  "excludeFiles": ["**/*.spec.ts"],
  "must": {
    "haveType": "file"
  }
}
```

The expanded convention `konsistent` runs is:

```json
{
  "name": "every-ts-file-must-have-tests",
  "description": "Every TypeScript file in src/ ...",
  "paths": ["src/{name:matches(^[^.]+$)}.ts"],
  "excludeFiles": ["**/*.spec.ts"],
  "must": {
    "haveFiles": ["${name}.test.ts"],
    "haveType": "file"
  }
}
```

Note that `excludeFiles` was fully replaced (array-replace), while `must` was deep-merged (`haveType` added without dropping the inherited `haveFiles`).

## Restrictions

- **Reusable conventions only support object-form `must` and `mustNot`.** They cannot ship the `MustBlock[]` form. This keeps override semantics predictable — you always know the merge target is a flat predicate object. Your own hand-written conventions can still use `MustBlock[]` in `must`; `mustNot` is object-form only everywhere. See [predicates.md](./predicates.md).
- **The `conventionSources` value is a single string.** No object form (`{ package: ... }` / `{ path: ... }`) — auto-detection by leading `.` / `/` is unambiguous.
- **No cross-source merging.** Two `conventionSources` entries cannot be merged into a single prefix. If two packages happen to ship a convention with the same name, your vendor prefix scopes them.
- **`MustBlock[]` cannot be introduced via override.** Because the source convention's `must` is always object-form, deep-merge keeps the result object-form.

## Placeholder validation

After expansion, `konsistent` walks every string inside each merged convention's `must` and `mustNot` and checks that each `${placeholder}` referenced is declared as `{placeholder}` in at least one `paths` entry. This catches mismatches between a reusable convention's templates and the `paths` you supplied at the use-site, before any file is scanned.

## Error reference

All errors below are returned from `loadConfig()` as `{ success: false, error }` and surfaced by the CLI before any scanning starts.

| Condition | Error string | What to do |
| --- | --- | --- |
| Unknown vendor prefix | `Unknown convention source "<prefix>" referenced in conventions[<i>]. Declare it in conventionSources or fix the typo.` | Add an entry to `conventionSources`, or correct the prefix in the reference. |
| Unknown convention name within a source | `No convention "<name>" in source "<prefix>". The package exports: <list>.` | Pick one of the listed names, or check that you depend on the right version of the source package. |
| String-form reference to a paths-less convention | `Convention "<prefix>/<name>" cannot be referenced by string; it has no "paths". Use { use: "<prefix>/<name>", paths: [...] } form.` | Switch to the `use` form and supply `paths` for your project. |
| `use` reference with no `paths` on either side | `Convention "<prefix>/<name>" referenced in conventions[<i>] has no "paths". Either the reusable convention must declare paths, or the override must supply paths.` | Add `paths` to your override. |
| Path source unreadable | `Convention source "<prefix>" → "<value>": could not read file at <path>.` | Check the path exists and is readable. |
| Path source malformed JSON | `Convention source "<prefix>" → "<value>": malformed JSON at <path>.` | Fix the JSON or rebuild the source artifact. |
| npm source not installed | `Convention source "<prefix>" → "<specifier>": could not resolve npm package "<specifier>". The package may not be installed under the consumer's project.` | Install the package as a dependency. |
| npm source missing exports condition | `Convention source "<prefix>" → "<specifier>": package does not declare an exports["./konsistent"] entry.` | The source package isn't a reusable-convention package; check the spelling or pick a different source. |
| Reusable-convention package fails schema validation | `Convention source "<prefix>" → "<specifier>": invalid reusable-convention package at <path>: <issues>` | The author shipped an invalid package; report upstream. |
| Empty source value | `Convention source "<prefix>" has empty value.` | Supply a path or npm specifier. |
| Placeholder used in `must` or `mustNot` but not declared in `paths` or `placeholders` | `Convention "<identifier>" references "${<placeholder>}" in <key>, but neither paths nor placeholders declare "{<placeholder>}".` | Either declare the placeholder in `paths` or `placeholders`, or remove the unresolved template. |
| `use` inside `must[]` points at a reusable that declares `paths`/`severity` | `Convention "<prefix>/<name>" referenced in conventions[<i>].must[<j>] declares top-level-only field(s) "<field>". Such conventions can only be referenced at the top level of conventions[]. Either remove the field(s) from the source convention, or move the reference out of must[].` | Drop `paths`/`severity` from the reusable, or reference it directly from `conventions[]`. |

`<identifier>` in the placeholder error is the convention's `name`, the `<vendor>/<name>` reference, or `conventions[<i>]` — whichever was available.

## See also

- [Authoring reusable conventions](../guides/authoring-reusable-conventions.md) — publish your own.
- [konsistent.json reference](./configuration.md) — the surrounding config shape.
- [Path patterns](./path-patterns.md) — placeholder syntax used in `paths`, `must`, and `mustNot`.
