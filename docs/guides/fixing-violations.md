# Fixing violations

Once `konsistent.json` is in place, running the CLI will surface violations. The mechanical part — renaming a file, adding an export, fixing a type — is usually obvious. The hard part is two decisions you have to make first:

1. **Is the rule wrong, or is the code wrong?** When many files violate the same rule, the rule may encode a convention the codebase hasn't actually adopted. Fixing the code without questioning the rule produces churn.
2. **Which violations are trivial, and which require design decisions?** Trivial fixes (renames, moves, re-exports) can be batched. Non-trivial fixes (new types, new logic, refactors) need scope decisions.

This guide walks through both.

## Workflow

1. [Run the CLI and collect violations as JSON](#1-run-the-cli).
2. [Group violations by rule](#2-group-violations-by-rule) and identify rules with high violation counts.
3. [Decide rule vs. code](#3-decide-rule-vs-code) for each high-count rule.
4. [Update `konsistent.json`](#4-update-konsistentjson) for any rules that need to change.
5. [Re-run the CLI](#5-re-run-and-confirm) to refresh the violation list.
6. [Triage remaining violations into trivial vs. non-trivial](#6-triage-trivial-vs-non-trivial).
7. [Decide on backwards-compatibility for renamed package-boundary exports](#7-decide-on-backwards-compatibility).
8. [Apply the fixes](#8-apply-the-fixes).
9. Re-run and verify with the project's other checks (`typecheck`, `test`, lint).

## 1. Run the CLI

Use JSON output so the violations are easy to programmatically group:

```bash
pnpm konsistent check --format=json --max-diagnostics=1000
```

Each violation has the shape:

```json
{
  "severity": "error",
  "conventionName": "must-export-and-more",
  "filePath": "packages/openai/src/index.ts",
  "predicateName": "exportValues",
  "message": "Missing export \"openai\""
}
```

If the command fails for reasons other than violations (config not found, invalid config, missing dependency), resolve the underlying issue first.

## 2. Group violations by rule

Aggregate by `conventionName` (and optionally `predicateName`). A rule is **high-count** when it has roughly **5+ violations** OR represents **more than half** of the matched files for that rule's path pattern. A rule with 4 violations across 4 files where the pattern only matches 5 files is also high-count.

Why this matters: a rule with 1–2 violations almost always means the *code* is the outlier. A rule with many violations often means the *rule* itself encodes a convention the codebase has not actually adopted. Fixing the code without questioning the rule produces churn and may overwrite the team's real convention.

## 3. Decide rule vs. code

For each high-count rule, look at the codebase distribution and decide.

Frame the question with:
- The rule's name / description / what it enforces.
- The codebase distribution — how many of the matched files conform vs. violate.
- A summary of what convention the violating files actually follow (read 2–3 of them — what naming/structure pattern do they share?).
- A few representative examples from each pattern.

The options:

- **Keep the rule, fix the code** — code is the outlier; proceed to fix violations.
- **Change the rule to match what the code does** — the violating pattern is the real convention; update `konsistent.json`.
- **Remove the rule** — the convention isn't worth enforcing.
- **Other** — relax to `severity: warning`, narrow the path pattern, add an exception via path negation, split into a hybrid rule.

When "change the rule" admits more than one specific shape, surface the sub-options instead of collapsing them. Examples worth considering:
- File-naming variants: `${name}-options.ts` vs. `${name}-model-options.ts`.
- A **hybrid** rule that splits by a sub-pattern (e.g., "single-word providers ending in `ai` use flat-case; everything else uses camelCase") — encodable via [case maps](../reference/case-maps.md) or [`placeholderSatisfies`](../reference/conditional-rules.md#placeholdersatisfies) constraints.
- Mixed-severity (`error` for must-have, `warning` for nice-to-have).

For low-count rules, assume the code is wrong and skip ahead.

## 4. Update `konsistent.json`

Apply config changes from step 3. Validate after every edit:

```bash
pnpm konsistent validate
```

See [configuration.md](../reference/configuration.md) for the full schema, [predicates.md](../reference/predicates.md) for the predicate catalog, and [conditional-rules.md](../reference/conditional-rules.md) for `if`/`ifNot`/`for` blocks.

## 5. Re-run and confirm

After config changes (or after step 3 if no changes were needed), re-run the CLI for a fresh violation list:

```bash
pnpm konsistent check --format=json --max-diagnostics=1000
```

This is the last review of the rule set before mass code changes. If something looks off, return to step 3.

## 6. Triage: trivial vs. non-trivial

Classify every remaining violation. The triage rubric below covers each predicate.

### Search before classifying — the most common trivial case

`konsistent` reports the *expected* name and location. The actual symbol or file very often **already exists in the codebase under a different name or in a different file**. These are still trivial: rename, relocate, or re-export.

Before classifying any violation as non-trivial, search for likely matches:

1. **By exact name** — grep for the expected name across the repo.
2. **By case variants** — `kebab-case`, `camelCase`, `PascalCase`, `snake_case`. The symbol may exist in another casing.
3. **By stripped prefixes/suffixes** — strip `create`, `make`, `build`, `Provider`, `Service`, `Config`, `Adapter`, `Factory`. A `createFooProvider` rule may correspond to existing `makeFoo` or `Foo`.
4. **By word stem / partial match** — grep the most distinctive token. For `OpenaiProviderSettings`, search `openai` and look at all matches; the type may be called `OpenAIConfig`, `OpenAISettings`, `OpenaiOptions`.
5. **By shape** — for typed signatures, grep for distinctive parts of the expected type (return type, param shape) — the function may exist under another name with the right signature.
6. **In sibling locations** — read the directory at `dirname(filePath)`, the parent directory, and known sibling modules matched by the same path pattern. The symbol may live in `provider.ts` instead of `${name}-provider.ts`, in a sibling barrel, in `lib/`, in `internal/`.
7. **Mirror existing successful matches** — find files matched by the same rule that *do* satisfy it and inspect how they are structured. The violating file usually deviates in a small, mechanical way.

If a search turns up a strong candidate, the fix is **trivial**:
- Symbol under wrong name → **rename** (and update all references across the repo, including tests/fixtures).
- Symbol in wrong file → **move** the definition (or re-export from the expected location).
- File at wrong path / wrong name → **rename or move** the file (and update imports).
- Type expressed differently (`interface` vs. `type`) → adjust the form.

When in doubt, classify as **non-trivial**. False trivial classifications produce bad code without thinking; false non-trivial classifications just delay the fix.

### Per-predicate rubric

#### `haveType`

Message: `Expected file but found directory` (or vice versa).

- **Trivial**: convert a single-file module to a directory by moving the file to `<dir>/index.ts`, or collapse a directory containing only `index.ts` into a single file. Update imports.
- **Non-trivial**: convert a directory containing many files into one file (requires merging) — defer.

#### `haveFiles`

Message: `Missing required file "X"`.

Search first: read the matched directory. Is the expected content present in a file with a different name (e.g. expected `${name}-provider.ts`, found `provider.ts`)? Is it in a subdirectory? Is it split across files?

- **Trivial**:
  - Expected content lives under another filename → **rename** the file.
  - Expected content lives in a sibling directory → **move** the file.
  - Missing file would be a re-export barrel or a derivable wrapper → create it referencing existing siblings.
- **Non-trivial**: no candidate found, and the file requires writing new logic. Defer unless intent is supplied.

Always check what *should* go in the file by reading sibling files matched by the same path pattern. If a clear template exists, the violation is trivial.

#### `exportValues` / `exportConstants`

Message: `Missing export "X"` / `Missing export const "X"`.

Search first: grep for `X`, case variants, stripped variants (`createX` ↔ `X`, `XProvider` ↔ `X`), and the stem.

- **Trivial**:
  - Symbol exists in the file, not exported → add `export`.
  - Symbol exists in a sibling file → add a re-export (or move the definition).
  - Symbol exists under a different name → **rename** and update all references.
  - Symbol exists in the wrong casing → **rename** to the expected casing.
- **Non-trivial**: no candidate found anywhere after search. Creating it requires implementing functionality. Defer unless intent is supplied.

For `exportConstants`, the value must be a `const`. If a `let` or `function` exists under the right name, conversion to `const` is safe only if there are no reassignments — verify by grepping.

When a constant entry includes `schema`, the constant must also have a matching explicit type annotation. Add or adjust the annotation only after confirming the initializer and all assignments satisfy it. Schema checks support scalar, literal-union enum, homogeneous array, and inline object annotations; array items and object properties may require an exact type reference. They do not infer initializer types or resolve referenced types. For object schemas, every configured property must be declared. Names in `required` must be non-optional, while other configured names must include `?`.

#### `exportTypes`

Message: `Missing export type "X"` or `Type "X" ...` for schema mismatches.

Search first: grep for `X`, case variants, stripped suffixes (`XConfig` ↔ `X` ↔ `XOptions` ↔ `XSettings` ↔ `XProps`), and `interface X` vs. `type X`.

- **Trivial**:
  - Type exists (anywhere reachable) under that name → re-export it.
  - Type exists under a different name → **rename**.
  - Type exists as `interface` when `type` is expected (or vice versa) and the shape is compatible → adjust the form.
  - Type is trivially derivable (e.g., `type FooConfig = Parameters<typeof createFoo>[0]`) and the consumer pattern is obvious from siblings → write the alias.
- **Non-trivial**: no candidate after search, and the type would require designing a new shape. Defer.

When an entry includes `schema`, inspect the local type alias or interface rather than searching for a re-export. Every configured object property must exist with the exact required/optional status expressed by `required`; configured scalar types and type references must match the annotation exactly. Unconfigured properties are allowed unless `additionalProperties` is `false`. Do not replace a local schema-constrained type with a cross-file re-export, because `schema` and `from` are mutually exclusive.

#### `exportFunctions`

Message: `Missing export function "X"` or `Function "X" must receive param of type "Y"` / `... return value of type "Y"`.

Search first: grep for `X`, case variants, common prefix/suffix variants (`createX` ↔ `makeX` ↔ `buildX` ↔ `X`), and check signatures of close matches.

- **Trivial — name only**: function exists with wrong name → **rename or move**. Update call sites.
- **Trivial — signature with existing types**: function exists with the right name but wrong parameter or return type, and the expected types exist → adjust the type annotation (no behavior change required).
- **Trivial — split**: logic exists across multiple functions; combining them under the expected name is mechanical → consolidate and rename.
- **Non-trivial — missing function**: no candidate after search. Defer.
- **Non-trivial — signature mismatch with new types**: parameter or return type required, but the type does not exist after search. Defer — creating the type *and* making the function conform is a design decision.
- **Non-trivial — runtime behavior change**: function exists but cannot satisfy the new signature without rewriting body logic. Defer.

#### `exportInterfaces`

Message: `Missing export interface "X"` or `Interface "X" must extend "Y"`.

Search first: grep for `X`, case variants, suffix variants. Also grep for `type X = { ... }` — the rule may want an `interface`, but the equivalent type alias may already exist.

- **Trivial**:
  - Interface exists under wrong name → **rename**.
  - Equivalent `type X = { ... }` exists → convert to `interface` (when shape allows).
  - Interface exists and the required base interface also exists → add `extends Y`.
- **Non-trivial**:
  - Interface and base both missing after search → defer.
  - Adding `extends Y` would conflict with existing fields → defer.

#### `exportClasses`

Message: `Missing export class "X"`, `Class "X" must extend "Y"`, or `Class "X" must implement "Z"`.

Search first: grep for `X` and case/suffix variants. Also look for object factories (`createX` returning an object) that mirror what the class would do — these may need to be converted to a class.

- **Trivial**:
  - Class exists under wrong name → **rename**.
  - Class exists, missing `extends Y`, the base class exists, and members do not conflict.
  - Class exists, missing `implements Z`, the interface exists, and the class already satisfies `Z`'s shape (verify).
- **Non-trivial**:
  - No candidate after search.
  - Adding `extends`/`implements` requires adding new methods or refactoring existing ones to match the contract.
  - Base class or interface does not exist after search.

#### `importValues` / `importTypes` / `importValuesFrom` / `importTypesFrom`

Message: `Missing import "X" from "<module>"`, `Missing import type "X" from "<module>"`, or `Missing import from "<specifier>"`.

Search first: confirm the export `X` exists at `<module>` for named-import rules, or that the target module specifier is already used by sibling files for `importValuesFrom` or `importTypesFrom`. If not, find where `X` (or its variants) is currently imported from.

- **Trivial**:
  - Export exists at the specified module path → add the import statement.
  - Symbol is currently imported from a different path → change the import path.
  - For `importValuesFrom` or `importTypesFrom`, a sibling file uses the same import kind and exact specifier, or a subpath covered by a configured `/*` wildcard, for the same role → add the analogous import.
- **Non-trivial**:
  - Export does not exist at the target path *and* the symbol does not exist anywhere. Usually cascades from a separate violation — fix that first; this one may resolve automatically.
  - For `importValuesFrom` or `importTypesFrom`, no sibling establishes why the dependency should exist. Adding a new dependency may be a design decision.

If a single module source is missing an export and many consumers fail `importValues` rules pointing at it, fix the source once; consumers will then validate. Address the root cause, not the downstream symptoms.

## 7. Decide on backwards-compatibility

Before editing any public API, decide on backward-compatibility for renamed exports. Answer this once, then apply uniformly.

### Is the project in a breaking-change window?

- **Breaking changes acceptable** (major-version bump, beta line, pre-1.0, internal-only project) — plain renames everywhere. No aliases.
- **Need back-compat** — proceed below.

### If back-compat is required, classify each rename

Back-compat only matters for symbols exported across the **package boundary**. Internal renames within a package are noise to alias.

- **Package-boundary export (public API)** — the symbol is reachable from outside the package via its entry points. Determine this by checking the `package.json` `exports` / `main` / `module` / `types` fields and tracing what each entry point re-exports (typically `src/index.ts`). If reachable via any entry point → **alias required**.
- **Internal-only export** — the `export` keyword is used between files within the same package, but the symbol is not reachable from any entry point. **No alias.** Rename freely and update intra-package call sites.

For monorepos, repeat per package — a rename in `packages/foo/src/utils.ts` may be internal to `foo` even if `foo`'s entry point exports many other symbols.

For each package-boundary rename, keep a deprecated alias alongside the new name in the entry point:

```ts
export { newName } from "./impl";
/** @deprecated Use `newName` instead. */
export { newName as oldName } from "./impl";
```

Update intra-package callers to use the new name. Document the renames in the changelog if the project tracks one.

## 8. Apply the fixes

Order:
1. All trivial violations from step 6.
2. The "attempt" non-trivial violations with available context.

Group fixes by file when possible to minimize churn. Don't re-run `konsistent` between individual fixes — batch the edits.

When done, re-run the CLI:

```bash
pnpm konsistent check --format=json --max-diagnostics=1000
```

Report what's resolved, what remains, and whether new violations appeared. If new violations appeared, investigate before declaring complete.

Finally, run the project's other checks to verify edits didn't break anything else:

```bash
pnpm typecheck
pnpm test
pnpm check
```

## General heuristics

- **Read the file first.** A "Missing export X" message is meaningless until you know whether `X` is defined locally, imported, or absent entirely.
- **Search the repo aggressively.** Most "missing" things exist under another name or in another file — the violation is the rule pointing at the deviation, not at true absence.
- **Mirror successful matches.** Find files matched by the same rule that pass; compare the failing file's structure against them and replicate.
- **Check for cascades.** When many violations point at the same source file (re-export barrel, shared type module), fixing the source once may resolve many downstream violations. Identify cascades before working on individual violations.
- **Renames are mechanical only when references are tracked down.** Always grep for the old name across the repo — including tests, fixtures, and docs — and update every site.
- **A "trivial" classification is a claim that you searched and found a candidate.** If verification was skipped, treat as non-trivial.
