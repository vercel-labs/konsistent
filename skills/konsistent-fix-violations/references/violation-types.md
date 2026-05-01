# Violation Triage Reference

Predicate-by-predicate guide for classifying konsistent violations as **trivial** vs **non-trivial**. The `predicateName` field in the JSON output identifies which predicate failed.

A violation is **trivial** only when:
1. The fix target (symbol, type, file) already exists somewhere reachable, OR is a pure rename, OR can be relocated from another file/name, AND
2. The fix can be made without inventing new logic, types, or structural decisions, AND
3. Updating direct importers/consumers is straightforward (no API surface design needed).

When any of these are uncertain, classify as **non-trivial**.

## Search before classifying — this is the most common trivial case

`konsistent` reports the *expected* name and location. The actual symbol or file very often **already exists in the codebase under a different name or in a different file**. These cases are trivial: rename, relocate, or re-export.

Before classifying any violation as non-trivial, search for likely matches:

1. **By exact name** — grep for the expected name across the repo (it might already exist somewhere unexpected).
2. **By case variants** — search for the expected name in `kebab-case`, `camelCase`, `PascalCase`, `snake_case`. `konsistent` enforces a specific casing; the symbol may exist in another casing.
3. **By stripped prefixes/suffixes** — strip `create`, `make`, `build`, `Provider`, `Service`, `Config`, `Adapter`, `Factory`, etc. and search the stem. A `createFooProvider` rule may correspond to existing `makeFoo` or `Foo`.
4. **By word stem / partial match** — search for the most distinctive token (e.g. for `OpenaiProviderSettings`, search `openai` and look at all matches; the type may be called `OpenAIConfig`, `OpenAISettings`, `OpenaiOptions`).
5. **By shape** — for typed signatures, grep for distinctive parts of the expected type (return type, param shape) — the function may exist under another name with the right signature.
6. **In sibling locations** — read the directory at `dirname(filePath)`, the parent directory, and known sibling modules matched by the same path pattern. The symbol may live in `provider.ts` instead of `${name}-provider.ts`, in a sibling barrel, in `lib/`, in `internal/`, etc.
7. **Mirror existing successful matches** — find files matched by the same rule that *do* satisfy it and inspect how they are structured. The violating file usually deviates in a small, mechanical way (filename, export name, casing, location).

If a search turns up a strong candidate, the fix is **trivial**:
- Symbol under wrong name → **rename** (and update all references across the repo, including tests/fixtures).
- Symbol in wrong file → **move** the definition (or re-export from the expected location).
- File at wrong path / wrong name → **rename or move** the file (and update imports).
- Type expressed differently (e.g. `interface` vs `type`) → adjust the form.

Only classify as non-trivial when no plausible candidate exists after a thorough search.

When in doubt, do the search before deciding. False non-trivial classifications waste user attention; false trivial classifications produce bad code.

## Table of Contents

- [haveType](#havetype)
- [haveFiles](#havefiles)
- [export / exportConstants](#export--exportconstants)
- [exportTypes](#exporttypes)
- [exportFunctions](#exportfunctions)
- [exportInterfaces](#exportinterfaces)
- [exportClasses](#exportclasses)
- [import / importTypes](#import--importtypes)

---

## haveType

Message: `Expected file but found directory` (or vice versa).

- **Trivial**: convert a single-file module to a directory by moving the file to `<dir>/index.ts`, or collapse a directory containing only `index.ts` into a single file. Update imports.
- **Non-trivial**: convert a directory containing many files into one file (requires merging) — defer.

## haveFiles

Message: `Missing required file "X"`.

**Search first**: read the matched directory. Is the expected content present in a file with a different name (e.g. expected `${name}-provider.ts`, found `provider.ts`)? Is it in a subdirectory? Is it split across files?

- **Trivial**:
  - Expected content lives under another filename → **rename** the file.
  - Expected content lives in a sibling directory → **move** the file.
  - Missing file would be a re-export barrel (`index.ts` re-exporting siblings) or a derivable wrapper → create it referencing existing siblings.
- **Non-trivial**: no candidate found, and the file requires writing new logic (e.g. a missing `${name}-stem.ts` containing provider-specific implementation). Defer unless the user supplies the implementation intent.

Always check what *should* go in the file by reading sibling files matched by the same path pattern. If a clear template exists, the violation is trivial.

## export / exportConstants

Message: `Missing export "X"` / `Missing export const "X"`.

**Search first**: grep for `X`, case variants of `X`, stripped variants (`createX` ↔ `X`, `XProvider` ↔ `X`), and the stem. Read the file in question and its siblings.

- **Trivial**:
  - Symbol exists in the file, not exported → add `export`.
  - Symbol exists in a sibling file → add a re-export (or move the definition into the expected file).
  - Symbol exists under a different name (in this file or elsewhere) → **rename** and update all references.
  - Symbol exists in the wrong casing → **rename** to the expected casing.
- **Non-trivial**: no candidate found anywhere after search. Creating it requires implementing functionality. Defer unless the user provides intent.

For `exportConstants` specifically, the exported value must be a `const`. If a `let` or `function` exists under the right name, the change is trivial only if converting to `const` is safe (no reassignment elsewhere). Verify by grepping for assignments.

## exportTypes

Message: `Missing export type "X"`.

**Search first**: grep for `X`, case variants, stripped suffixes (`XConfig` ↔ `X` ↔ `XOptions` ↔ `XSettings` ↔ `XProps`), and `interface X` vs `type X`. Inspect candidate types' shapes.

- **Trivial**:
  - Type exists (anywhere reachable) under that name → re-export it.
  - Type exists under a different name → **rename**. Search for all uses of the old name and update.
  - Type exists as `interface` when `type` is expected (or vice versa) and the shape is compatible → adjust the form.
  - Type is trivially derivable (e.g. `type FooConfig = Parameters<typeof createFoo>[0]`) and the consumer pattern is obvious from siblings → write the alias.
- **Non-trivial**: no candidate after search, and the type would require designing a new shape (object fields, generics, unions). Defer — the user should specify the shape, or the rule should be relaxed.

## exportFunctions

Message: `Missing export function "X"` or `Function "X" must receive param of type "Y"` / `... return value of type "Y"`.

**Search first**: grep for `X`, case variants, common prefix/suffix variants (`createX` ↔ `makeX` ↔ `buildX` ↔ `X`), and check signatures of close matches.

- **Trivial — name only**: function exists with wrong name (or in wrong file) → **rename or move**. Update call sites.
- **Trivial — signature with existing types**: function exists with the right name but wrong parameter or return type, and the expected types exist → adjust the type annotation (no behavior change required).
- **Trivial — split**: logic exists across multiple functions; combining them under the expected name is mechanical → consolidate and rename.
- **Non-trivial — missing function**: no candidate after search. Defer.
- **Non-trivial — signature mismatch with new types**: parameter or return type is required but the type does not exist (after search). Defer — creating the type *and* making the function conform is a design decision.
- **Non-trivial — runtime behavior change**: function exists but cannot satisfy the new signature without rewriting body logic. Defer.

## exportInterfaces

Message: `Missing export interface "X"` or `Interface "X" must extend "Y"`.

**Search first**: grep for `X`, case variants, suffix variants. Also grep for `type X = { ... }` — the rule may want an `interface`, but the equivalent type alias may already exist.

- **Trivial**:
  - Interface exists under wrong name → **rename**.
  - Equivalent `type X = { ... }` exists → convert to `interface` (when shape allows).
  - Interface exists and the required base interface also exists → add `extends Y`.
  - The interface is trivially expressible as `interface X extends Y {}` and no extra fields are needed.
- **Non-trivial**:
  - Interface and base both missing after search → defer.
  - Adding `extends Y` would conflict with existing fields (members need reconciliation) → defer.

## exportClasses

Message: `Missing export class "X"`, `Class "X" must extend "Y"`, or `Class "X" must implement "Z"`.

**Search first**: grep for `X` and case/suffix variants. Also look for object factories (`createX` returning an object) that mirror what the class would do — these may need to be converted to a class.

- **Trivial**:
  - Class exists under wrong name → **rename**.
  - Class exists, missing `extends Y`, the base class exists, and members do not conflict.
  - Class exists, missing `implements Z`, the interface exists, and the class already satisfies `Z`'s shape (verify by reading both).
- **Non-trivial**:
  - No candidate after search.
  - Adding `extends`/`implements` requires adding new methods or refactoring existing ones to match the contract.
  - Base class or interface does not exist after search.

## import / importTypes

Message: `Missing import "X" from "<module>"` or `Missing import type "X" from "<module>"`.

**Search first**: confirm the export `X` exists at `<module>`. If not, find where `X` (or its variants) is currently imported from.

- **Trivial**:
  - Export exists at the specified module path → add the import statement (and use the symbol if the rule's intent implies usage; check for downstream type errors after).
  - Symbol is currently imported from a different path → change the import path.
- **Non-trivial**:
  - Export does not exist at the target path *and* the symbol does not exist anywhere. Usually cascades from a separate violation — fix that first; this one may resolve automatically.

If a single source file is missing an export and many consumers fail `import` rules pointing at it, fix the source once; consumers will then validate. Address the root cause, not the downstream symptoms.

---

## General heuristics

- **Read the file first.** A "Missing export X" message is meaningless until you know whether `X` is defined locally, imported, or absent entirely.
- **Search the repo aggressively.** Most "missing" things exist under another name or in another file — the violation is the rule pointing at the deviation, not at true absence. Use `grep` / `Grep` with name variants, case variants, prefix/suffix strips, and stem matching before classifying as non-trivial.
- **Mirror successful matches.** Find files matched by the same rule that pass, compare the failing file's structure against them, and replicate.
- **Check for cascades.** When many violations point at the same source file (re-export barrel, shared type module), fixing the source once may resolve many downstream violations. Identify cascades before working on individual violations.
- **Renames are mechanical only when references are tracked down.** Always grep for the old name across the repo — including tests, fixtures, and docs — and update every site.
- **A "trivial" classification is a claim that you searched and found a candidate.** If verification was skipped, treat as non-trivial.
