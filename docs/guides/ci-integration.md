# CI integration

`konsistent` is designed to run as part of CI. This guide covers the CI-specific bits — workflow setup, posting violations to PRs, combining with other checks. For commands, flags, output formats, and exit codes, see [cli.md](../reference/cli.md).

## GitHub Actions

`konsistent` auto-detects GitHub Actions via `GITHUB_ACTIONS=true` and switches to the [`github` output format](../reference/cli.md#output-formats). No flags needed:

```yaml
name: konsistent

on:
  pull_request:
  push:
    branches: [main]

jobs:
  check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v6
      - uses: pnpm/action-setup@v5
      - uses: actions/setup-node@v6
        with:
          node-version: 24
          cache: pnpm
      - run: pnpm install --frozen-lockfile
      - run: pnpm konsistent
```

Violations appear inline on the PR diff as `::error` or `::warning` annotations. Errors fail the job; warnings do not (unless [`--error-on-warnings`](../reference/cli.md#flags) is set).

## Posting violations as a PR comment

Combine `--format=markdown` with the GitHub CLI:

```yaml
- name: Run konsistent
  id: konsistent
  run: |
    pnpm konsistent check --format=markdown > konsistent-report.md || true

- name: Comment on PR
  if: github.event_name == 'pull_request'
  run: gh pr comment ${{ github.event.pull_request.number }} -F konsistent-report.md
  env:
    GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

The `|| true` keeps the comment step running even when `konsistent` exits non-zero. Add a separate step that re-runs `konsistent` (without the redirect) to restore the failure exit code.

## Strict CI flags

For stricter pipelines, see the [flags reference](../reference/cli.md#flags). The CI-relevant ones:

- `--error-on-warnings` — fail the build on warnings as well as errors.
- `--diagnostic-level error` — skip warning-severity conventions entirely (faster than evaluating and filtering).
- `--max-diagnostics=<n>` — raise the default cap of 100 if your codebase produces more violations during initial adoption.

## Failing fast on config errors

Run `validate` before `check` in CI to surface config errors clearly (separate red flag from convention violations):

```yaml
- run: pnpm konsistent validate
- run: pnpm konsistent check
```

See [`validate`](../reference/cli.md#validate) for the success/failure semantics.

## Disabling the update check

In CI, suppress the auto-update prompt:

```yaml
env:
  KONSISTENT_NO_UPDATE_CHECK: "true"
```

## Driving scripts and agents

For custom reports, gating, or agent workflows, use [`--format=json`](../reference/cli.md#json). Group results by `conventionName` to identify high-count rules — see [fixing-violations.md](./fixing-violations.md).

## Pre-commit / pre-push

For a local guard before pushing, add a husky or lefthook hook that runs `pnpm konsistent`. Since `konsistent` checks the whole codebase rather than individual files, prefer running it in CI and reserving local hooks for the fastest checks. If you do run it pre-push, use `--diagnostic-level error` to keep it snappy.

## Combining with other checks

`konsistent` is structural — it does not replace lint, format, type, or test checks. A typical CI job:

```yaml
- run: pnpm install --frozen-lockfile
- run: pnpm typecheck
- run: pnpm test
- run: pnpm check        # lint + format
- run: pnpm konsistent
```

Run `konsistent` after the lighter checks so structural failures surface against a known-good baseline.
