# Authoring reusable conventions

This guide walks you through publishing a package of reusable conventions that other repos can consume by name. The runnable reference is `@konsistent/common-conventions` in this repo — the skeleton below distills it into the smallest working shape.

For the consumer-facing reference (how a `konsistent.json` declares `conventionSources` and references your package), see [reusable-conventions.md](../reference/reusable-conventions.md).

> **Reusable conventions vs. shared full configs.** This guide covers packages that ship *individual* conventions consumed via `conventionSources` — the artifact has the `ReusableConventionsPackageV1` shape and is exposed at `exports["./konsistent"]`. A different pattern is shipping a *full* `konsistent.json` (the `ConfigV1` shape) that consumers load via `konsistent --config-package <pkg>`. For that, drop a `konsistent.json` at the package's `dist/` (or the package root, or a path declared via the `package.json` `"konsistent"` field). See [cli.md](../reference/cli.md#flags) for `--config-package`.

## What you ship

A reusable-conventions package ships a single JSON artifact at a fixed exports condition. The JSON has a `conventionSpecVersion: "v1"` literal and a `conventions: ReusableConvention[]` array. Consumers find it via:

```json
{
  "exports": {
    "./konsistent": "./dist/conventions.json"
  }
}
```

You can write the conventions directly in JSON, but the recommended path is to author them in TypeScript with `defineConventions()` from `@konsistent/convention` and let the package's `konsistent-convention emit` CLI build the JSON for you. You get full editor autocomplete, schema validation at build time, and a single source of truth for the published artifact — without writing a build script of your own.

## 1. Install `@konsistent/convention`

`@konsistent/convention` owns the schemas, the `defineConventions()` helper, and the `konsistent-convention` build CLI. It has Zod as a peer dependency.

| NPM | PNPM | Bun |
| --- | --- | --- |
| `npm install @konsistent/convention zod --save-dev` | `pnpm add @konsistent/convention zod --save-dev` | `bun add @konsistent/convention zod --dev` |

For a package whose only purpose is to ship conventions, `@konsistent/convention` can be a runtime `dependency` and `zod` a `peerDependency` — exactly what `@konsistent/common-conventions` does.

## 2. Lay out the package

Minimal skeleton:

```
my-conventions/
  package.json
  src/
    index.ts         # author the conventions in TypeScript
  dist/
    conventions.json # produced by `konsistent-convention emit` (gitignored)
```

### `package.json`

```json
{
  "name": "my-conventions",
  "version": "0.1.0",
  "type": "module",
  "files": ["dist", "src"],
  "exports": {
    "./konsistent": "./dist/conventions.json"
  },
  "scripts": {
    "build": "konsistent-convention emit"
  },
  "dependencies": {
    "@konsistent/convention": "^0.0.1"
  },
  "peerDependencies": {
    "zod": "^4"
  }
}
```

The required pieces:

- `"exports": { "./konsistent": "./dist/conventions.json" }` — what `konsistent` resolves on the consumer side.
- `"files"` includes `dist` so the JSON ships with the published package.
- `"build"` script that produces `dist/conventions.json` before publishing. The `konsistent-convention` CLI is exposed as a `bin` of `@konsistent/convention`, so you can call it directly from any package script.

### `src/index.ts`

```ts
import { defineConventions } from "@konsistent/convention";

export const conventions = defineConventions([
  {
    name: "package-dir-must-have-readme-file",
    description:
      "Every package directory under packages/ must contain a README.md file.",
    paths: ["packages/*"],
    must: {
      haveFiles: ["README.md"],
    },
  },
] as const);
```

`defineConventions()` is a typed identity function — it returns its input unchanged but constrains the type to `ReusableConvention[]` so your editor flags missing fields, typos, and shape mismatches. The `as const` keeps literal types narrow for downstream inference.

A reusable convention has the same fields as a hand-written one with two adjustments:

- `name` and `description` are **required** (consumers see them in error messages and source listings).
- `must` and `mustNot` must use the **flat object form** (`MustPredicates`). The `MustBlock[]` form is not allowed in reusable conventions — see [Restrictions](../reference/reusable-conventions.md#restrictions).
- `paths` is **optional**. Omit it to force consumers to supply `paths` at the use-site (which is useful when the right pattern depends on the consuming project's layout). When `paths` is omitted, consumers can only reference the convention via the `use` form.
- `if` is optional. At the top level it gates the complete expanded convention separately for every matched path, and consumers using the object form can replace it with another complete condition. The same field gates one block when the convention is referenced inside a parent's `must[]`.
- `for` only applies when the convention is referenced inside a parent's `must[]`; top-level references do not carry it into the resolved convention.

## 3. Build and verify

```bash
pnpm build
```

Behind `pnpm build`, `konsistent-convention emit` does three things: imports `src/index.ts` (TypeScript loaded at runtime), validates the conventions against `ReusableConventionsPackageV1Schema` (so your build fails fast on a malformed convention), and writes `dist/conventions.json` with `conventionSpecVersion: "v1"` prepended. `conventionSpecVersion: "v1"` pins the spec your conventions target — future versions can change format and consumers will be told to upgrade `konsistent`.

The CLI's defaults are `--input src/index.ts` and `--output dist/conventions.json`. Override either if your layout differs:

```bash
konsistent-convention emit --input src/conventions.ts --output dist/my-rules.json
```

The input module must export a `conventions` array (named or default export) whose elements pass `ReusableConventionV1Schema`.

Inspect `dist/conventions.json` — it should have `conventionSpecVersion: "v1"` at the top level and one entry per convention.

You can validate by hand against the published JSON Schema at `node_modules/@konsistent/convention/reusable-convention-package.schema.json` if your editor supports it.

## 4. Consume from a sibling repo

Locally during development, link the package via your workspace tool (pnpm workspace, npm workspace, or `npm link`). Then in any consumer's `konsistent.json`:

```json
{
  "$schema": "node_modules/konsistent/konsistent.schema.json",
  "version": "v1",
  "conventionSources": {
    "myteam": "my-conventions"
  },
  "conventions": [
    "myteam/package-dir-must-have-readme-file"
  ]
}
```

Run `pnpm konsistent` in the consumer; the convention runs as if it had been written inline.

For a convention without `paths`, the consumer must use the `use` form and supply `paths`:

```json
{
  "use": "myteam/file-must-export-equivalent-component-function",
  "paths": ["src/components/{componentName}.tsx"]
}
```

## 5. Publish

`npm publish` once the `build` step is part of your `prepublishOnly` or your release flow. The consumer-side resolver looks up `<package>/konsistent` via Node's exports condition — no further configuration required on either side.

## What to put in your conventions

A reusable convention is most useful when it captures a structural rule that's specific to a library or organization but agnostic to the consuming project's layout. Two patterns work well:

- **Self-contained** — the convention declares its own `paths` (e.g. `packages/*` for any project that uses a `packages/` monorepo layout). Consumers reference it as a string.
- **Use-site paths** — the convention omits `paths` and parameterizes via placeholders that the consumer's `paths` declares (e.g. `must.exportFunctions: [{ name: "${componentName}" }]` with no `paths` at all). Consumers must use the `use` form and supply `paths` like `["src/components/{componentName}.tsx"]`.

Mix-and-match: a single package can ship both kinds. `@konsistent/common-conventions` ships three conventions — one of each shape, plus one with `paths` and `excludeFiles` to demonstrate array-replace overrides.

## Versioning

`conventionSpecVersion: "v1"` is the spec version, separate from your package's `version`. Bump your package's version on every release; `conventionSpecVersion` only changes if `konsistent` itself ships a new convention spec. Existing v1 packages keep working when consumers upgrade `konsistent` minor versions.

## See also

- [Reusable conventions reference](../reference/reusable-conventions.md) — the consumer side.
- [konsistent.json reference](../reference/configuration.md) — surrounding config shape.
- [Predicates](../reference/predicates.md) — what you can express inside `must`.
