---
name: konsistent-fix-violations
description: >
  Run the konsistent CLI, review all reported violations, and fix them in the codebase.
  Use when the user wants to "fix konsistent violations", "resolve konsistent errors",
  "clean up konsistent diagnostics", "make konsistent pass", "address structural convention
  violations", or asks to run konsistent and act on the results. The skill is interactive:
  it requires explicit user decisions when many violations stem from the same rule (rule
  vs. code question), explicit user confirmation before modifying any code, and a triage
  step for non-trivial violations. For editing `konsistent.json`, this skill defers to the
  `konsistent-config` skill.
---

# konsistent — Fix Violations

Run `konsistent`, surface what is broken, and resolve violations. The hard part is not the mechanical fix — it is deciding **whether the rule or the code is wrong** when a single rule has many violations, and **which non-trivial violations are worth attempting** versus deferring.

The canonical workflow and per-predicate triage rubric are documented in `node_modules/konsistent/docs/guides/fixing-violations.md`. **Read it before classifying violations.** This skill layers strict gating, user confirmation, and `AskUserQuestion` interactions on top of that workflow.

## Workflow (strict order)

1. [Run the CLI](#1-run-the-cli) and collect all violations as JSON.
2. [Group violations by rule](#2-group-violations-by-rule) and identify rules with high violation counts.
3. [For each high-count rule, ask the user](#3-ask-the-user-rule-vs-code) whether to keep, change, or remove the rule.
4. [Update `konsistent.json`](#4-update-konsistentjson-via-konsistent-config) via the `konsistent-config` skill if any rules need changes.
5. [Re-run the CLI](#5-re-run-and-confirm-before-fixing) to refresh the violation list, then **stop and ask for explicit confirmation** before modifying any code.
6. [Triage remaining violations](#6-triage-trivial-vs-non-trivial) into trivial vs. non-trivial.
7. [Surface non-trivial violations](#7-surface-non-trivial-violations) to the user and let them decide how to handle each.
8. [Fix the approved violations](#8-fix-approved-violations) and re-run the CLI to verify.

Do not skip steps. Do not collapse them. The asks for user input at steps 3, 5, and 7 are non-negotiable.

---

## 1. Run the CLI

Determine the invocation in this order:

1. If `package.json` has a `konsistent` script → use the project's package manager: `pnpm konsistent`, `npm run konsistent`, or `yarn konsistent` (match the lockfile / `packageManager` field).
2. Else, if `konsistent` is in `devDependencies` → run via the package runner: `pnpm exec konsistent`, `npx konsistent`, etc.
3. Else, fall back to `npx konsistent`.

Run the `check` command with JSON output and a high diagnostic cap so nothing is truncated:

```bash
<runner> konsistent check --format=json --max-diagnostics=1000
```

Note: when invoking via an `npm`/`pnpm` script that already wraps `konsistent`, you may need `--` to forward flags:

```bash
pnpm konsistent check --format=json --max-diagnostics=1000
# OR if the script runs konsistent without args:
pnpm konsistent -- check --format=json --max-diagnostics=1000
```

The JSON output is an array of `{ severity, conventionName, filePath, predicateName, message }`. Exit code is non-zero when errors are present; that is expected — read the JSON regardless. See `node_modules/konsistent/docs/reference/cli.md` for the full output schema.

If the command fails for reasons other than violations (config not found, invalid config, missing dependency), stop and resolve the underlying issue first. Do not proceed.

## 2. Group violations by rule

Aggregate the violations by `conventionName` (and optionally `predicateName`). Compute a count per group. Report the totals to the user briefly:

> Found N violations across M conventions. Rule `X` has K violations; rule `Y` has J violations; …

A rule is "high-count" when it has roughly **5+ violations** OR represents **more than half** of the violating files for that rule's path pattern. Use judgment — a rule with 4 violations across 4 files where the path pattern only matches 5 files is also high-count.

Why this matters: a rule with 1–2 violations almost always means the *code* is the outlier. A rule with many violations often means the *rule* itself encodes a convention the codebase has not actually adopted — fixing the code without questioning the rule produces churn and may overwrite the team's real convention.

## 3. Ask the user: rule vs. code

For **each high-count rule**, explicitly ask the user to choose. Use the AskUserQuestion tool with concrete options. Do not infer — the user owns this decision.

Frame the question with:
- The rule's name / description / what it enforces.
- **The codebase distribution** — count how many of the *matched* files conform vs. violate, and report the split (e.g. "12 of 25 matched packages use pattern A; 13 use pattern B — codebase is roughly 50/50"). This framing dramatically improves the user's ability to decide.
- A short summary of what convention the violating files actually follow (read 2–3 of them — what naming/structure pattern do they share?).
- A few representative examples (file paths or symbol names from each pattern).

Offer at minimum these options:
- **Keep the rule, fix the code** — code is the outlier; proceed to fix violations.
- **Change the rule to match what the code does** — the violating pattern is the real convention; update `konsistent.json`.
- **Remove the rule** — the convention isn't worth enforcing.
- **Other** (free-text — e.g. relax to `severity: warning`, narrow the path pattern, add an exception via path negation).

**Surface meaningful sub-options** when "change the rule" admits more than one specific shape. Don't collapse them. Examples of sub-options worth presenting:
- File-naming variants: `${name}-options.ts` vs `${name}-model-options.ts`.
- A **hybrid** rule that splits by a sub-pattern (e.g. "single-word providers ending in `ai` use flat-case; everything else uses camelCase") — this is encodable via `kebabToCamelMap` / `kebabToPascalMap` overrides or `placeholderSatisfies` constraints.
- Mixed-severity (`error` for the must-have, `warning` for the nice-to-have).

If the user picks "change", "remove", or "other", capture the specifics needed to execute the change in step 4.

Skip this step for low-count rules — assume code is wrong and fix in step 8.

## 4. Update `konsistent.json` via konsistent-config

If any rule needs to change based on step 3 decisions, **defer to the `konsistent-config` skill** for the actual edits. That skill knows the predicate catalog, path placeholder syntax, case map overrides, conditional/iterative blocks, and the project conventions for `konsistent.json`. Do not edit `konsistent.json` ad-hoc here.

When delegating, hand over: the rule name(s) being changed, the user's decision, and the concrete change (e.g. "change `exportFunctions` name template from `${name.toPascalCase()}Service` to `create${name.toPascalCase()}Service`", "add `severity: warning`", "add path negation for `packages/test-utils`").

After the config is updated, validate:

```bash
<runner> konsistent validate
```

Fix any config errors before continuing.

## 5. Re-run and confirm before fixing

After config changes (or after step 3 if no changes were needed), **re-run the CLI** to get a fresh violation list reflecting the new rules:

```bash
<runner> konsistent check --format=json --max-diagnostics=1000
```

Report the updated count to the user. Then **stop and ask for explicit confirmation** before touching any code:

> "Ready to start fixing N code violations. Proceed?"

Use AskUserQuestion with a clear yes/no. **Do not begin code edits until the user confirms.** This gate is the user's last chance to review the rule set before mass changes.

If the user says no or wants to adjust further, return to step 3 or 4.

## 6. Triage: trivial vs. non-trivial

Once confirmed, classify each remaining violation. **Read `node_modules/konsistent/docs/guides/fixing-violations.md` for the per-predicate triage rubric and the search heuristics** before classifying.

The headline rules:

- **Search the codebase first.** A "missing" file or export reported by `konsistent` very often already exists under a different name, in a different file, or in a different casing. These are still **trivial** fixes — rename, move, or re-export. Before marking anything non-trivial, search by exact name, case variants, stripped prefixes/suffixes, distinctive word stems, sibling locations, and mirror existing successful matches.
- **When in doubt, classify as non-trivial.** False positives in the trivial bucket are worse than in the non-trivial bucket — the former lead to bad code without user input. But do not classify as non-trivial without first searching: a quick grep often turns the violation trivial.

The full per-predicate rubric (haveType, haveFiles, export/exportConstants, exportTypes, exportFunctions, exportInterfaces, exportClasses, import/importTypes) lives in `node_modules/konsistent/docs/guides/fixing-violations.md`.

## 7. Surface non-trivial violations

Compile the non-trivial violations into a clear list. For each, include:
- File path and rule.
- The violation message.
- A one-line note on why it is non-trivial (e.g. "type `FooConfig` does not exist anywhere in the repo", "would require splitting the existing class").

Present the list to the user and ask, **per violation or per group**, which they want to:

- **Defer** — leave for later. Offer two follow-ups:
  - Draft a GitHub issue title/body capturing the work (the user opens it).
  - **Add path negation in `konsistent.json`** for the deferred files via the `konsistent-config` skill, so CI stays green and the rule still applies to all other matched files. Remove the negation when the deferred work lands.
- **Attempt** — let the agent try; **prompt the user for additional context** that would help (intended types, examples to mirror, references to similar code).
- **Skip** — explicitly mark as won't-do (e.g. the rule will be relaxed instead — note this and return to step 4 if needed).

Use AskUserQuestion for the decision. For "Attempt", actively prompt for context — do not silently start a non-trivial change without input.

## 8. Fix approved violations

**Before editing any public API**, decide on backward-compatibility for renamed exports. This is the most important decision at the start of this step — answer it once, then apply uniformly across the run.

### 8a. Ask: is the project in a breaking-change window?

Use AskUserQuestion. Frame it: "Renames will affect package-boundary exports. Are breaking changes acceptable, or do we need to keep back-compat via deprecated aliases?"

- **Breaking changes acceptable** (e.g. major-version bump, beta line, pre-1.0, internal-only project) — plain renames everywhere. No aliases. Skip 8b.
- **Need back-compat** — proceed to 8b to identify which renames cross the package boundary; only those get aliases.

### 8b. If back-compat is required, classify each rename

Back-compat only matters for symbols exported across the **package boundary**. Internal renames within a package are noise to alias.

- **Package-boundary export (public API)** — the symbol is reachable from outside the package via its entry points. Determine this by checking the `package.json` `exports` / `main` / `module` / `types` fields and tracing what each entry point re-exports (typically `src/index.ts`). If reachable via any entry point → **alias required**.
- **Internal-only export** — the `export` keyword is used between files within the same package, but the symbol is not reachable from any entry point. **No alias.** Rename freely and update intra-package call sites.

For monorepos, repeat this check per package — a rename in `packages/foo/src/utils.ts` may be internal to `foo` even if `foo`'s entry point exports many other symbols.

For each package-boundary rename, keep a deprecated alias alongside the new name in the entry point:

```ts
export { newName } from "./impl";
/** @deprecated Use `newName` instead. */
export { newName as oldName } from "./impl";
```

Update intra-package callers to use the new name. Document the renames in the changelog if the project tracks one.

See `node_modules/konsistent/docs/guides/fixing-violations.md` for the rationale behind the package-boundary distinction.

Fix in this order:

1. All trivial violations from step 6.
2. The "Attempt" non-trivial violations from step 7, with the user's context.

Group fixes by file when possible to minimize churn. Do not re-run konsistent between individual fixes — batch the edits.

When done, re-run the CLI:

```bash
<runner> konsistent check --format=json --max-diagnostics=1000
```

Report:
- Violations resolved.
- Violations remaining (deferred + any new ones introduced).
- If new violations appeared, investigate before declaring complete.

Run the project's checks to ensure code edits did not break anything else (read `package.json` for the actual scripts):

```bash
pnpm typecheck
pnpm test
pnpm check
```

---

## Important guardrails

- **Never** edit `konsistent.json` to silence violations *after* step 4 without going back through step 3. The point of the rule-vs-code decision is to make it deliberate.
- **Never** skip the confirmation gate at step 5. Even when there are zero high-count rules and no config changes, ask before mass-editing code.
- **Never** classify a violation as trivial just because the message looks short. Read the file first; verify the target symbol/type/file actually exists.
- When fixing renames, search for all references in the codebase and update them — do not leave dangling imports.
- If running konsistent reveals zero violations, report that and stop. There is nothing to fix.
