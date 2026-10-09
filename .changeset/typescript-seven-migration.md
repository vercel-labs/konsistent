---
"konsistent": minor
"@konsistent/convention": patch
---

Migrate TypeScript-based structural checks and repository tooling to TypeScript
7.0.2. Preserve existing syntax-only predicate behavior, source positions, CLI
outputs, and package entrypoints. Checks use the native compiler through its
unstable synchronous API, with isolated virtual files and per-run cleanup.

Keep platform-specific optional dependencies enabled when installing Konsistent.
Node.js 22.11.0 remains the minimum supported version. Build JavaScript with
esbuild and emit convention package declarations with the native compiler.
