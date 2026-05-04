# Case maps

Case-transformation methods like `${name.toPascalCase()}` use built-in casing rules by default. For acronyms (`AI`, `API`, `DB`, `URL`) and unconventional casing, those defaults produce wrong output:

```
${name.toPascalCase()}   // openai → "Openai"   (wrong: should be "OpenAI")
${name.toCamelCase()}    // openai → "openai"   (wrong: should be "openAI")
```

Declare top-level case maps in `konsistent.json` to override the defaults.

## `kebabToPascalMap`

Override `toPascalCase()` and `toNthSegmentPascalCase()` for specific kebab-case values.

```json
{
  "version": "v1",
  "kebabToPascalMap": {
    "openai": "OpenAI",
    "graphql": "GraphQL",
    "api": "API"
  }
}
```

With this map:
- `${name.toPascalCase()}` for `openai` → `OpenAI`
- `${name.toPascalCase()}` for `mistralai` → `Mistralai` (no entry, falls back to default)
- `${name.toNthSegmentPascalCase(0)}` for `openai-chat` → `OpenAI`

## `kebabToCamelMap`

Override `toCamelCase()` and `toNthSegmentCamelCase()` for specific kebab-case values.

```json
{
  "version": "v1",
  "kebabToCamelMap": {
    "openai": "openAI",
    "graphql": "graphQL"
  }
}
```

`${name.toCamelCase()}` for `openai` → `openAI`.

## Worked example

```json
{
  "version": "v1",
  "kebabToPascalMap": {
    "openai": "OpenAI",
    "graphql": "GraphQL"
  },
  "kebabToCamelMap": {
    "openai": "openAI"
  },
  "conventions": [
    {
      "paths": "providers/{providerId}/index.ts",
      "must": {
        "exportFunctions": [
          { "name": "create${providerId.toPascalCase()}Provider" }
        ],
        "exportTypes": ["${providerId.toPascalCase()}ProviderConfig"]
      }
    }
  ]
}
```

For `providers/openai/index.ts`, the rule expects:
- `createOpenAIProvider` (instead of the default `createOpenaiProvider`)
- `OpenAIProviderConfig` (instead of `OpenaiProviderConfig`)

Without the case map, the rule would flag every correctly-named `OpenAI*` export as a violation.

## Inverse and cross maps

Only `kebabToPascalMap` and `kebabToCamelMap` are configurable. The inverse and cross-direction maps are **derived automatically**:

| Direction | Source |
| --- | --- |
| `pascalToKebabMap` | inverse of `kebabToPascalMap` |
| `camelToKebabMap` | inverse of `kebabToCamelMap` |
| `pascalToCamelMap` | composed: `pascal → kebab → camel` |
| `camelToPascalMap` | composed: `camel → kebab → pascal` |

This means `${name.toKebabCase()}` for `OpenAI` resolves to `openai` automatically — declaring `kebabToPascalMap` is enough to make the round-trip work.

## When to use case maps

Add an entry to a case map when:
- An identifier in your codebase contains an acronym (`AI`, `API`, `DB`, `URL`, `OAuth`, `HTTP`, …) and the default casing breaks names.
- A vendor or product name uses unusual casing (`GraphQL`, `OpenAI`, `iOS`).

Skip case maps when:
- The kebab-case form is purely lowercase letters and the PascalCase / camelCase form follows standard rules. The defaults handle these correctly without overrides.

Run `konsistent validate` after adding entries — typos in keys are silent (no error from the schema), but you'll see them quickly when running `konsistent check` reports unexpected violations.
