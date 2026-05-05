# konsistent - AGENTS.md

`konsistent` is a CLI tool that enforces structural conventions in TypeScript codebases via `konsistent.json` config files.

It is distinctively different from existing linters like oxlint or Biome, which focus more on code style and certain best practices.

Consistent project structure reduces cognitive overhead, simplifies onboarding, and makes codebases predictable. `konsistent` automates enforcement of these conventions so teams spend less time debating structure and more time building features.

## Motivation

_Enforce consistent code, for agents and humans._

Consistency has always been a crucial part of good API design, but there has never been a way to programmatically enforce it. With more and more work done by coding agents, consistency is now even more important, since coding agents thrive when exposed to consistent API behaviors:

- Coding agents used for developing and maintaining a library with consistent APIs perform better at adding new features that follow those conventions.
- Coding agents used for developing a project that uses a library with consistent APIs perform better at using said library correctly.

## Workflow Commands

- `pnpm install` — install dependencies
- `pnpm build` — compile packages
- `pnpm typecheck` — run TypeScript type checking
- `pnpm test` — run Vitest unit tests
- `pnpm test:e2e` — run e2e tests (requires build)
- `pnpm check` — lint/format check via Ultracite
- `pnpm fix` — auto-fix lint/format issues

## Testing Requirements

Every change needs test coverage. Include Vitest unit tests, but more holistically every feature must also be covered by e2e CLI tests using fixtures, which in this case are actual TypeScript demo projects with their own `konsistent.json` configuration files each.

Additionally, you can use the locally built `konsistent` tool via `pnpm konsistent`.

## Documentation Requirements

The top-level `docs/` folder contains documentation, across two subfolders:

- `docs/guides/`
- `docs/reference/`

Run `ls docs/guides/ docs/reference/` to learn which documentation files exist. Whenever you modify something in the codebase, check whether any of those files cover the area you touched; if so, update them in the same change so the docs stay in sync with the code.
