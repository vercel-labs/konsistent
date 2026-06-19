# Exploring codebases

Before writing a `konsistent.json`, explore the codebase to identify structural patterns that are worth enforcing. This guide explains what to look for and how to distinguish real patterns from coincidence.

The objective is **not** to write a config that produces zero violations on day one. The objective is to encode the conventions the codebase already follows (or wants to follow), even when 100% adherence hasn't happened yet. `konsistent` will then surface the deviations.

## General approach

1. Start by understanding the top-level directory layout (`ls`, `tree`, or globbing).
2. Look for **parallel directory structures** — directories that contain similarly-shaped contents (e.g., `packages/*`, `modules/*`, `providers/*`, `adapters/*`).
3. Within parallel structures, examine multiple entries (at least 3–5) to see what's consistent and what varies.
4. Only codify a pattern if it appears **3 or more times**. Two occurrences are a weak signal — note them but don't focus on them unless nothing stronger exists. A single occurrence is never a pattern.

## What to look for

### Directory structure and required files

For each parallel directory group, check which files appear in most or all entries:

```bash
# See what files each package contains
ls packages/*/src/
ls modules/*/
```

Look for:
- Barrel files (`index.ts`) that appear in every entry.
- Implementation files whose names follow the directory name (e.g. `packages/foo/src/foo-provider.ts`).
- Supporting files like `README.md`, `package.json`, config files, test files, story files.

If most directories contain the same set of files, that's a [`haveFiles`](../reference/predicates.md#havefiles) pattern.

### Export naming patterns

Open the barrel files (typically `index.ts`) across multiple parallel directories and compare:

- Do they all export a value whose name derives from the directory name? (e.g., `packages/openai/src/index.ts` exports `openai`.)
- Do they all export types following the same naming convention? (e.g., `FooProvider`, `BarProvider` → `${name.toPascalCase()}Provider`.)
- Do they export factory functions following a pattern? (e.g., `createFooService`, `createBarService` → `create${name.toPascalCase()}Service`.)
- Do they export constants with fixed names? (e.g., every plugin exports `pluginId`.)

For each export you find, classify it:
- **Templated**: name derives from the directory/file name via a case transformation (these become `${placeholder.toPascalCase()}` etc.).
- **Fixed**: same literal name everywhere (these become plain string values like `"activate"`).

### Classes and inheritance

Search for class declarations across parallel structures:

```bash
grep -r "export class" adapters/
```

Check:
- Do class names follow a pattern based on the directory or file name? (e.g., `FooAdapter`, `BarAdapter`.)
- Do they extend a common base class? (e.g., `extends BaseAdapter`.)
- Do they implement common interfaces? (e.g., `implements Connectable`.)

### Interfaces and extension

Search for interface declarations the same way:

- Do interface names follow a pattern? (e.g., `${name.toPascalCase()}Provider`.)
- Do they extend a shared base interface? (e.g., `extends ProviderV1`.)

### Import patterns

When you find consistent exports, also check the imports:

- Do files consistently import from the same module? (e.g., every provider imports `ProviderV1` from `@ai-toolkit/core`.)
- Do type-only imports follow a pattern?

Import checks are most useful when they validate a **dependency relationship** — every adapter must import its base class from a specific module, not from a local copy.

### Function signatures

For exported functions that follow a naming pattern, check their signatures:

- Do they consistently receive a parameter of a specific type? (e.g., `config: ${name.toPascalCase()}Config`.)
- Do they consistently return a specific type? (e.g., `${name.toPascalCase()}Service`.)

### Re-export patterns

Check if barrel files re-export from specific submodules:

- Do `index.ts` files consistently re-export from a file whose name follows the directory name?
- Do they re-export from a fixed set of submodules?

This is the [`from`](../reference/predicates.md#export) field on `export` and `exportTypes`.

### Conditional patterns

Some files exist only in some entries (test files, story files). When they exist, do they follow conventions that the test framework or type checker can't enforce? These become [`if`](../reference/conditional-rules.md#ifhasfile) / [`for`](../reference/conditional-rules.md#forfiles) blocks:

- If `.stories.tsx` files exist, do they always export a `meta` constant? (Storybook needs it; the type checker doesn't enforce.)
- If a `.test.tsx` file exists, does it import the project's custom render or test-context helper? (Project convention; lint rules don't know about it.)
- If a route file exists, does it export the expected HTTP method handlers (`GET`, `POST`, …)?

Avoid encoding rules that the test framework, bundler, or type checker would already reject — those are wasted CPU. Konsistent is for the structural conventions that nothing else catches.

## Identifying patterns vs. noise

### The 3+ rule

A structural convention must appear **at least 3 times** to be considered a pattern. This is the minimum threshold.

### Majority rules

Patterns may not be adhered to 100% across the codebase — that's exactly what `konsistent` is for. When you see variation:

- **8 files follow pattern A, 3 follow pattern B** → This is ONE pattern (A). The 3 outliers are likely violations that `konsistent` should flag.
- **5 files follow pattern A, 4 follow pattern B** → Ambiguous. Decide which convention to enforce, or skip it.
- **10 files follow a pattern, 1 doesn't** → Strong pattern. The outlier is a violation.

Always align with the majority. Don't try to make the config accommodate every variant — the goal is to identify the intended convention, not to achieve zero errors.

### Account for naming variation

When examining names, look past minor inconsistencies to see the underlying pattern:

- `createOpenAIProvider`, `createAnthropicProvider`, `createMistralProvider` → pattern is `create${name.toPascalCase()}Provider`. The casing variation for acronyms is what [`kebabToPascalMap`](../reference/case-maps.md) is for.
- `foo-service.ts`, `bar-service.ts`, `baz-svc.ts` → the majority says `${name}-service.ts`; the third is likely a violation.

### Don't force patterns

If a group of directories genuinely has no structural consistency, don't invent conventions. `konsistent` should encode patterns that actually exist (or should exist), not impose arbitrary structure.

## Exploration checklist

Use this as a systematic walkthrough:

1. **Map the layout**: What are the top-level directories? Which contain parallel entries?
2. **For each parallel group**:
   - How many entries are there? (Need 3+ for a pattern.)
   - What files does each entry contain? Which are consistent?
   - Open 3–5 barrel files (`index.ts`). What do they export? Are names templated or fixed?
   - Search for `export class` — any shared base classes or interfaces?
   - Search for `export interface` — any shared base interfaces?
   - Search for `export function` or `export const ... =` with arrow functions — any naming patterns or signature patterns?
   - Check imports — any consistent dependencies?
3. **Check for acronyms/special casing**: Do any identifiers use acronyms (AI, API, DB, URL) that need [`kebabToPascalMap`](../reference/case-maps.md) or [`kebabToCamelMap`](../reference/case-maps.md) overrides?
4. **Prioritize**: Start with the strongest patterns (most occurrences, clearest naming). Add weaker patterns only if they still meet the 3+ threshold.

## Translate findings into `konsistent.json`

For every pattern you identify:
- Path → glob with placeholders for the parts that vary.
- Required files → `haveFiles`.
- Local declarations → `declareTypes`, `declareConstants`, `declareFunctions`, `declareInterfaces`, `declareClasses`.
- Exports → `export`, `exportTypes`, `exportConstants`, `exportFunctions`, `exportInterfaces`, `exportClasses`.
- Imports → `import`, `importTypes`, `importFromCurrentDir`, `importFromParents`, `importFromExternals`.
- Optional file conditions → `if.hasFile` blocks.
- Subset-only rules → `if.placeholderSatisfies` with a `matches` or `segments` constraint.

See [examples.md](./examples.md) for ready-made templates of each shape, and [predicates.md](../reference/predicates.md) for the full predicate catalog.
