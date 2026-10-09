---
"konsistent": minor
"@konsistent/convention": patch
---

Migrate TypeScript-based structural checks and repository tooling to TypeScript
7.0.2. Preserve existing syntax-only predicate behavior, source positions, CLI
outputs, and package entrypoints. Checks use the native compiler through its
unstable synchronous API, with isolated virtual files and per-run cleanup.

Keep platform-specific optional dependencies enabled when installing Konsistent.
Supported Node.js versions are 22.18.0 or later in the 22.x release line, 24.11.0
or later in the 24.x release line, and 26.0.0 or later. Build JavaScript and
convention package declarations with tsdown, using the native TypeScript compiler
for declarations.
