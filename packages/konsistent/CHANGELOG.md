# konsistent

## 1.0.0-beta.7

### Patch Changes

- b24deb6: feat(konsistent): allow object properties and array items in constant and type definition schemas to enforce exact TypeScript type references
- 5b5deea: chore(konsistent): restructure packages following konsistent enforcement
- Updated dependencies [b24deb6]
- Updated dependencies [5b5deea]
  - @konsistent/convention@1.0.0-beta.7

## 1.0.0-beta.6

### Patch Changes

- f05e8b3: fix(konsistent): match variable-depth `**` alongside `{placeholder}` segments and glob-style `excludeFiles` patterns

  `**` in a `paths` pattern next to a `{placeholder}` segment previously only matched a single intermediate directory level instead of every depth, because placeholder extraction required the pattern and path to have the same number of segments. `excludeFiles` entries prefixed with `**/` were silently ignored for the same reason. Path matching now backtracks through variable-depth `**` segments when extracting placeholders and when matching `excludeFiles` glob patterns, so both now behave as documented.

  `excludeFiles` glob matching now delegates to picomatch, so it also correctly supports brace alternation (`{a,b}`) and character classes (`[ab]`), matching the same glob syntax `paths` resolves through. It no longer treats a `{name}` segment as a capturing placeholder: a brace group with no comma or range is matched literally, since `excludeFiles` patterns are plain glob patterns rather than placeholder patterns.

- a4af28c: feat(konsistent): allow filtering paths covered via `--paths`, `--modified`, and `--staged` flags
- Updated dependencies [f05e8b3]
  - @konsistent/convention@1.0.0-beta.6

## 1.0.0-beta.5

### Patch Changes

- 81f7863: feat(konsistent): add nested source selector handling for both `importValuesFrom` and `importTypesFrom`
- 949472f: feat(konsistent): split `importFrom` into `importValuesFrom` and `importTypesFrom` and rename existing bare import predicates to their `importValues*` equivalents for clarity and consistency
- ed02f5c: feat(konsistent): support requiring aliases for value and type imports and exports
- Updated dependencies [81f7863]
- Updated dependencies [949472f]
- Updated dependencies [ed02f5c]
  - @konsistent/convention@1.0.0-beta.5

## 1.0.0-beta.4

### Patch Changes

- 8455569: feat(konsistent): validate schemas for declared and exported type definitions
- Updated dependencies [8455569]
  - @konsistent/convention@1.0.0-beta.4

## 1.0.0-beta.3

### Patch Changes

- aac62d5: feat(konsistent): allow enforcing types for declared or exported constants
- Updated dependencies [aac62d5]
  - @konsistent/convention@1.0.0-beta.3

## 1.0.0-beta.2

### Patch Changes

- b424bab: fix(konsistent): fix `importFrom` predicate to distinguish between exact vs sub match imports
- Updated dependencies [b424bab]
  - @konsistent/convention@1.0.0-beta.2

## 1.0.0-beta.1

### Patch Changes

- dd58f74: feat(konsistent): add new `importFrom` predicate to check for imports from a specific location
- Updated dependencies [dd58f74]
  - @konsistent/convention@1.0.0-beta.1

## 1.0.0-beta.0

### Major Changes

- 33e0606: feat(konsistent): initial beta release

### Patch Changes

- Updated dependencies [33e0606]
  - @konsistent/convention@1.0.0-beta.0
