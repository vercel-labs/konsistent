# Constraints

Constraints filter which placeholder values a rule applies to. They appear in two places:

1. **Inline path constraints** — `paths: "packages/{providerId:matches(^[a-z]+ai$)}"`. Captured paths whose value fails the constraint are skipped.
2. **`if.placeholderSatisfies`** — gates a `must` block on the placeholder's value (see [conditional-rules.md](./conditional-rules.md)).

Both contexts use the same `name:constraint(arg)` syntax.

## Catalog

| Constraint | Description |
| --- | --- |
| [`matches(regex)`](#matchesregex) | Placeholder value must match the regex. |
| [`segments(n)`](#segmentsn) | Placeholder value must have exactly `n` word segments. |

## `matches(regex)`

The placeholder value must match the JavaScript regex. Case-sensitive. The pattern is unanchored unless you anchor it explicitly with `^` and `$`.

### Inline path constraint

```json
{
  "paths": "packages/{providerId:matches(^[a-z]+ai$)}/src/${providerId}-stem.ts",
  "must": {
    "exportConstants": ["${providerId.extract(^([a-z]+)ai$)}"]
  }
}
```

Only providers whose ID ends in `ai` (e.g., `openai`, `mistralai`) are considered. The rule does not apply to `google`, `anthropic`, etc.

### `if.placeholderSatisfies`

```json
{
  "paths": "packages/{providerId}",
  "must": [
    { "must": { "haveFiles": ["src/index.ts"] } },
    {
      "if": { "placeholderSatisfies": "providerId:matches(^[a-z]+ai$)" },
      "must": { "haveFiles": ["src/${providerId}-stem.ts"] }
    }
  ]
}
```

The base rule (`src/index.ts` required) applies to every package. The conditional block (`src/${providerId}-stem.ts` required) applies only when `providerId` matches the regex.

## `segments(n)`

The placeholder value must split into exactly `n` word segments. Splitting is on `-`, `_`, or camelCase boundaries.

```
chat                    → 1 segment
chat-language           → 2 segments
chat-language-model     → 3 segments
chatLanguage            → 2 segments
chat_language           → 2 segments
```

### Inline use

```json
{
  "paths": "packages/{providerId}",
  "must": [
    {
      "for": {
        "files": "*/${providerId}-{modelKind:segments(2)}-model.ts"
      },
      "must": {
        "exportFunctions": [
          "create${providerId.toPascalCase()}${modelKind.toNthSegmentPascalCase(1)}Model${modelKind.toNthSegmentPascalCase(0)}"
        ]
      }
    },
    {
      "for": {
        "files": "*/${providerId}-{modelKind:segments(1)}-model.ts"
      },
      "must": {
        "export": [
          "${providerId.toPascalCase()}${modelKind.toPascalCase()}ModelConfig"
        ]
      }
    }
  ]
}
```

The first block matches files like `chat-language-model.ts` (2-segment `modelKind`); the second matches `embedding-model.ts` (1-segment `modelKind`). Different `must` predicates apply to each shape.

### `if.placeholderSatisfies`

```json
{
  "if": { "placeholderSatisfies": "modelKind:segments(2)" },
  "must": { "exportTypes": ["${modelKind.toPascalCase()}Config"] }
}
```

## Syntax notes

- The argument inside `(...)` is taken **verbatim** — no quotes around regexes or numbers.
- The argument may **not contain `}`**. If you need a regex quantifier, use repetition: `\d\d?` instead of `\d{1,2}`.
- Constraints apply to placeholder **values** (`{...}`) and to `placeholderSatisfies` arguments. They do not apply to template substitutions (`${...}`).
- An `if` block has exactly one of `hasFile` or `placeholderSatisfies` (see [conditional-rules.md](./conditional-rules.md)).

## Difference from path negation

[Path negation](./path-patterns.md#negation) (`"!packages/test-utils"`) excludes specific paths after they've been matched by other entries. Constraints operate on the captured value of a placeholder — they let you express "match every package whose name follows this shape" without enumerating exceptions.

Use constraints when the rule applies to a class of placeholders (e.g., "all AI providers"); use negation when the rule has a small list of literal exceptions.
