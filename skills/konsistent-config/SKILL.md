---
name: konsistent-config
description: >
  Create or modify a konsistent.json configuration file that enforces structural conventions in a TypeScript codebase.
  Use when the user wants to enforce consistent code structure, validate exports/imports across files,
  ensure directories contain required files, enforce naming patterns, add/remove/update convention rules,
  configure case map overrides for acronyms or special casing (kebabToPascalMap, kebabToCamelMap),
  or troubleshoot why konsistent is reporting violations.
  Triggers on: "konsistent", "konsistent.json", "enforce conventions", "structural consistency",
  "consistent exports", "consistent structure", "code conventions config", "add convention",
  "update convention", "fix konsistent errors", "case map", "case override", "acronym casing".
---

# konsistent Configuration

Create or modify a `konsistent.json` file that enforces structural conventions for the project. The `konsistent` CLI checks filesystem structure and TypeScript exports/imports — it is not a style linter.

## Core Objective

**Important reminder:** DO NOT write a `konsistent.json` file that leads to zero errors when running the `konsistent` check. That would defeat the purpose. The objective is to create a `konsistent.json` file that identifies violations to patterns used in the codebase, even if they are not being 100% adhered to. Add conventions based on dominant patterns in the codebase, even if other instances violate those patterns.

Treat the existing codebase as evidence from which to infer conventions, not as a specification that every convention must accept. Existing files that do not follow a dominant pattern are expected findings, not proof that the convention is wrong.

A successful configuration can make `konsistent` exit with violations. The violations are the intended audit output. Only `konsistent validate` is expected to pass without errors.

## Workflow

### 1. Setting Up The `konsistent` CLI (only if not set up yet)

Check if the `konsistent` package is already installed:

- `konsistent` available in root `package.json`
- `node_modules/konsistent` directory exists
- a `konsistent` script exists in `package.json`

If not, the `konsistent` CLI must be installed first. Use the project's package manager. For example, with PNPM:

```bash
pnpm add konsistent --save-dev
```

Then, ensure `package.json` has a `konsistent` script which invokes the `konsistent` CLI. At a minimum:

```
  "scripts": {
    "konsistent": "konsistent"
  }
```

If or once all of these are ready, proceed to section 2.

### 2. Determining Operation Mode Based on Presence Of `konsistent.json` File

1. Check if `konsistent.json` already exists at the project root.
2. Read `node_modules/konsistent/konsistent.schema.json` to confirm the authoritative shape.
3. Read the relevant docs in `node_modules/konsistent/docs/` (see [References](#references) below) before making changes.
4. If `konsistent.json` exists: read it, then add/remove/update conventions as requested by the user.
5. If `konsistent.json` does not exist: create it at the project root.

### 3. Creating Or Editing The `konsistent.json` File

Explore the user's codebase to understand existing structure and naming patterns. Refer to `node_modules/konsistent/docs/guides/exploring-codebases.md` for what to look out for.

Make sure you review the codebase for structural conventions _holistically_. For large codebases with multiple layers of nested subdirectories, consider using subagents for individual sections of the codebase. Make each subagent aware of all the analysis requirements outlined in the following subsections, and use subagents to gather raw evidence rather than make final dominance decisions.

When subagents explore separate sections, ensure their findings can be combined into complete relevant cohorts. Each subagent must report the scope it examined, the total instances in that scope, conforming and nonconforming counts, competing patterns, and representative examples. The primary agent must merge these findings, reconstruct each complete cohort, and decide dominance using the combined evidence. A pattern that is dominant within one delegated section is not necessarily dominant across the complete cohort.

Consider conventions between related files as well, not only within a single file. Use the `haveFiles` predicate to ensure a specific other file exists based on the matched file, and use `for.files` to enforce conventions within specific other related files based on the matched file.

#### Required Pattern Evidence

Do not write the configuration until you have recorded the evidence for each candidate convention. For every candidate:

1. Define the complete relevant cohort, such as all sibling packages, adapters, routes, or barrel files. Consider conventions between related files as well, not only within a single file.
  - For example, use the `haveFiles` predicate to ensure a specific other file exists based on the matched file, and use `for.files` to enforce conventions within specific other related files based on the matched file.
2. Count the total cohort, the conforming instances, and the nonconforming instances. Always include the denominator; a few matching examples alone do not establish dominance.
3. Search for counterexamples as deliberately as you search for supporting examples. Inspect representative conforming and nonconforming instances.
4. Compare competing patterns. By default, a candidate is dominant only when it occurs at least three times and accounts for at least two-thirds of the relevant cohort.
5. When encountering competing patterns without a dominant "winner", pause and ask the user for which pattern to enforce (or whether to not enforce any of them).
6. For each convention established (either by dominant candidate or by user decision), decide whether nonconforming instances are violations or belong to a genuinely different semantic cohort. Existing variation by itself does not establish a legitimate exception.

Use an evidence table while exploring:

| Candidate convention | Cohort | Follows | Violates | Competing patterns | Decision |
| --- | --- | ---: | ---: | --- | --- |
| Every package has `src/index.ts` | 12 packages | 10 | 2 | None | Enforce |
| Service files use the `-service` suffix | 9 service files | 5 | 4 | `-service` vs. `-svc` | Ambiguous; ask user |

Do not invent conditions that make all competing variants valid. If the evidence is ambiguous, pause and ask the user which convention to enforce or whether to enforce none of them.

#### Adversarial Review

Before translating a candidate into configuration, try to disprove it:

- Search the entire cohort rather than stopping after finding several supporting examples.
- Look for a stronger competing convention or a semantic boundary that changes the cohort.
- Check whether another tool already enforces the behavior.
- Prefer a rule that exposes genuine outliers over one that explains every existing file.

The purpose of this review is to reject weak or invented patterns. It is not to eliminate violations of strong patterns.

When modifying an existing config:

- Preserve all conventions not related to the user's request.
- Preserve existing `name`, `description`, and `severity` values unless asked to change them.
- When adding conventions, append to the `conventions` array.
- When the user reports violations, read the existing config and the violating files to determine whether to fix the config or advise fixing the code.

#### Prohibited Optimization

NEVER optimize the configuration for any of the following outcomes:

- Zero reported violations.
- Making every existing file valid.
- Accommodating every observed variation.
- Reducing the violation count after running the CLI.
- Marking conventions with a `severity` of "warning" just to make the CLI pass with exit code 0.

Do not weaken, narrow, condition, or exclude a convention solely because existing code violates it.

#### Verification

Validate the generated config by running `konsistent validate` via the `package.json` script (e.g. `pnpm konsistent validate`).

After validation succeeds, freeze the evidence-based configuration and audit the actual codebase by running `konsistent` via the `package.json` script with no arguments. Treat reported violations as audit findings, not as configuration failures.

A post-audit configuration change is allowed only when one of the following is true:

- The configuration does not encode the pattern recorded in the evidence table.
- The path pattern accidentally includes a separate semantic cohort.
- The configuration uses the `konsistent` schema or predicate API incorrectly.
- Newly discovered code changes the recorded evidence enough that the candidate is no longer dominant.

“Existing files fail this rule” is never sufficient justification for changing the configuration. For every post-audit change, state which allowed reason applies and update the recorded evidence when relevant.

## References

All canonical documentation lives in `node_modules/konsistent/docs/` (published with the package). Read these before authoring config:

- `node_modules/konsistent/docs/reference/configuration.md` — top-level `konsistent.json` shape (version, conventions, severity, excludeFiles).
- `node_modules/konsistent/docs/reference/predicates.md` — every `must` predicate (`haveType`, `haveFiles`, `export`, `exportTypes`, `exportConstants`, `exportFunctions`, `exportInterfaces`, `exportClasses`, `import`, `importTypes`).
- `node_modules/konsistent/docs/reference/path-patterns.md` — globs, placeholders, case transformations (`toPascalCase`, `toCamelCase`, `toFlatCase`, `toNthSegment`, `extract`, …), negation.
- `node_modules/konsistent/docs/reference/constraints.md` — `matches`, `segments` for inline path constraints and `if.placeholderSatisfies`.
- `node_modules/konsistent/docs/reference/conditional-rules.md` — `if` / `for` / `excludeFiles` blocks when `must` is an array.
- `node_modules/konsistent/docs/reference/case-maps.md` — `kebabToPascalMap`, `kebabToCamelMap` for acronyms and special casing.
- `node_modules/konsistent/docs/guides/examples.md` — copy-pasteable common patterns (provider packages, factories, adapters, conditional rules, …).
- `node_modules/konsistent/docs/guides/exploring-codebases.md` — pattern-identification approach before writing rules.

## Configuration Syntax Recommendations

- Use `name` on conventions to give them identifiable IDs (must be kebab-case).
- Use `description` when the convention name alone isn't self-explanatory.
- Prefer templates with case transformations over hardcoded names — this is `konsistent`'s key strength.
- Group related predicates in one convention when they apply to the same path.
- Use separate conventions for the same path when different severities are needed.
- Use path negation to exclude known exceptions, but ONLY if it is a semantic category outside the convention's intended cohort, such as generated files, fixtures, vendored code, or a demonstrably distinct package category.

## Configuration Syntax Pitfalls

- Do not attempt to use `*` in declaration or export names. These wildcards are only allowed in path segments.

## Completion Report

When handing off the configuration, report:

- Every inferred convention and its evidence ratio, such as 10 of 12 instances.
- Representative conforming examples.
- Representative violations surfaced by the audit, or an explicit statement that none were found.
- Ambiguous candidate patterns that were intentionally skipped.
- Every exclusion and the semantic reason it is outside the convention's cohort.

Do not describe success as “`konsistent` passes.” Distinguish schema validation success from the codebase audit findings.
