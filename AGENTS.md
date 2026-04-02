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

<!-- opensrc:start -->

## Source Code Reference

Source code for dependencies is available in `opensrc/` for deeper understanding of implementation details.

See `opensrc/sources.json` for the list of available packages and their versions.

Use this source code when you need to understand how a package works internally, not just its types/interface.

### Fetching Additional Source Code

To fetch source code for a package or repository you need to understand, run:

```bash
npx opensrc <package>           # npm package (e.g., npx opensrc zod)
npx opensrc pypi:<package>      # Python package (e.g., npx opensrc pypi:requests)
npx opensrc crates:<package>    # Rust crate (e.g., npx opensrc crates:serde)
npx opensrc <owner>/<repo>      # GitHub repo (e.g., npx opensrc vercel/ai)
```

<!-- opensrc:end -->
