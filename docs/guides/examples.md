# Examples

A library of common patterns you can copy into your `konsistent.json`. Each example is a complete, valid convention — drop it in and adjust the path and names.

For deeper coverage of any concept, follow the cross-links to the reference docs.

## Provider packages

Every `packages/{providerId}` is a directory with a barrel and a provider implementation.

```json
{
  "name": "provider-packages",
  "paths": "packages/{providerId}",
  "must": {
    "haveType": "directory",
    "haveFiles": ["src/index.ts", "src/${providerId}-provider.ts"]
  }
}
```

See [`haveFiles`](../reference/predicates.md#havefiles) and [path placeholders](../reference/path-patterns.md#placeholders).

## Plugin packages

Every plugin must have specific files and exports:

```json
{
  "version": "v1",
  "conventions": [
    {
      "name": "plugin-directories",
      "paths": "plugins/{pluginName}",
      "must": {
        "haveType": "directory",
        "haveFiles": ["index.ts", "manifest.json", "README.md"]
      }
    },
    {
      "paths": "plugins/{pluginName}/index.ts",
      "must": {
        "exportValues": ["activate", "deactivate"],
        "exportConstants": ["pluginId"]
      }
    }
  ]
}
```

## Barrel re-exports matching directory name

Every package barrel exports a value named after the directory:

```json
{
  "paths": "packages/{name}/src/index.ts",
  "must": {
    "exportValues": ["${name}"],
    "exportTypes": ["${name.toPascalCase()}Config"]
  }
}
```

For acronym-aware casing (`openai` → `OpenAI`), see [case-maps.md](../reference/case-maps.md).

## Re-export source pinning

Force the barrel to re-export from a specific source file (catches stray local definitions in barrels):

```json
{
  "name": "barrel-re-exports",
  "description": "Barrel files must re-export from the correct source modules",
  "paths": "packages/{providerId}/src/index.ts",
  "must": {
    "exportValues": [{ "name": "${providerId}", "from": "./${providerId}-provider" }],
    "exportTypes": [
      {
        "name": "${providerId.toPascalCase()}Provider",
        "from": "./${providerId}-provider"
      }
    ]
  }
}
```

The `from` field on [`exportValues`](../reference/predicates.md#exportvalues) and [`exportTypes`](../reference/predicates.md#exporttypes) requires the export to be a re-export from the named module.

## Factory function with typed signature

Service factories must accept a typed config and return a typed service:

```json
{
  "description": "Each service must export a factory function with typed config param and typed return value",
  "paths": "services/{serviceName}/index.ts",
  "must": {
    "exportFunctions": [
      {
        "name": "create${serviceName.toPascalCase()}Service",
        "receiveParamsOfTypes": ["${serviceName.toPascalCase()}Config"],
        "returnValueOfType": "${serviceName.toPascalCase()}Service"
      }
    ]
  }
}
```

## Class extending base + implementing interface

```json
{
  "description": "Each adapter module must export a class extending BaseAdapter",
  "paths": "adapters/{adapterName}/adapter.ts",
  "must": {
    "exportClasses": [
      {
        "name": "${adapterName.toPascalCase()}Adapter",
        "extend": "BaseAdapter",
        "implement": ["Connectable"]
      }
    ],
    "importTypes": [{ "name": "BaseAdapter", "from": "@app/core" }]
  }
}
```

The `importTypes` rule enforces dependency direction — every adapter imports `BaseAdapter` from the core package, not from local copies.

## Interface inheritance with `allowOmissions`

When implementations may extend a generic variant of the base type:

```json
{
  "name": "provider-interface",
  "description": "Provider implementation must export an interface extending ProviderV1 or a variant",
  "paths": "packages/{providerId}/src/${providerId}-provider.ts",
  "must": {
    "exportInterfaces": [
      {
        "name": "${providerId.toPascalCase()}Provider",
        "extend": { "type": "ProviderV1", "allowOmissions": true }
      }
    ],
    "importTypes": [{ "name": "ProviderV1", "from": "@ai-toolkit/core" }]
  }
}
```

`allowOmissions` lets implementations satisfy the rule even if they extend a partial or generic variant of `ProviderV1`. See [`exportInterfaces`](../reference/predicates.md#exportinterfaces).

## Mixed severity

Hard requirement (`error`) plus a recommendation (`warning`) on the same path:

```json
{
  "version": "v1",
  "conventions": [
    {
      "name": "module-must-have-index",
      "severity": "error",
      "paths": "modules/{moduleName}",
      "must": {
        "haveFiles": ["index.ts"]
      }
    },
    {
      "name": "module-should-have-readme",
      "severity": "warning",
      "paths": "modules/{moduleName}",
      "must": {
        "haveFiles": ["README.md"]
      }
    }
  ]
}
```

Missing `index.ts` fails CI. Missing `README.md` shows a yellow warning but doesn't block. See [Severity](../reference/configuration.md#severity).

## Path negation for known exceptions

Every package barrel exports a function named after the package — except `test-utils`:

```json
{
  "name": "package-barrel-exports",
  "paths": [
    "packages/{packageName}/src/index.ts",
    "!packages/test-utils/src/index.ts"
  ],
  "must": {
    "exportValues": ["${packageName}"]
  }
}
```

See [path negation](../reference/path-patterns.md#negation).

## Conditional rules on optional files

Each `components/<Name>/` folder must have an `index.tsx`. Test files are optional, but when present must use the project's custom render helper. Story files (also optional) must export Storybook's `meta` constant:

```json
{
  "paths": "components/{componentName}",
  "must": [
    { "must": { "haveFiles": ["index.tsx"] } },
    {
      "if": { "hasFile": "index.test.tsx" },
      "for": { "files": "index.test.tsx" },
      "must": { "importValues": [{ "name": "render", "from": "@/test-utils" }] }
    },
    {
      "for": { "files": "*.stories.tsx" },
      "must": { "exportConstants": ["meta"] }
    }
  ]
}
```

Both rules enforce structural conventions that linters and the type checker won't catch: a missing `meta` makes Storybook silently misbehave, and a test that bypasses `@/test-utils`'s `render` skips the project's provider setup. See [conditional-rules.md](../reference/conditional-rules.md).

## Conditional rules on imports

Apply predicates only when the matched file imports a particular value, type, or module source:

```json
{
  "paths": "src/{moduleName}.ts",
  "must": [
    {
      "if": {
        "hasValueImport": { "name": "defineConfig", "from": "toolkit" }
      },
      "must": { "exportConstants": ["config"] }
    },
    {
      "if": { "hasTypeImportFrom": "@/shared-types" },
      "must": { "exportTypes": ["PublicOptions"] }
    }
  ]
}
```

Use `hasValueImport` or `hasTypeImport` to check one imported symbol. Use `hasValueImportFrom` or `hasTypeImportFrom` to check whether any import of that kind comes from an exact module source. See [conditional-rules.md](../reference/conditional-rules.md#import-predicates).

Put any of these same condition objects under `ifNot` to apply predicates only when the import is absent. `ifNot` always uses the same condition catalog and matching behavior as `if`.

## Iterating over file patterns

Every test file in a module must import the project's shared test context helper:

```json
{
  "name": "module-tests",
  "paths": "modules/{moduleName}",
  "must": [
    {
      "for": { "files": ["*.test.ts", "*.spec.ts"] },
      "must": { "importValues": [{ "name": "createTestContext", "from": "@/test-utils" }] }
    }
  ]
}
```

## Constraint-filtered subpattern

Apply different rules to AI providers (whose ID ends in `ai`) vs. other providers:

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

Or, equivalently, gate at the path level so the rule only matches AI providers in the first place:

```json
{
  "paths": "packages/{providerId:matches(^[a-z]+ai$)}/src/${providerId}-stem.ts",
  "must": {
    "exportConstants": ["${providerId.extract(^([a-z]+)ai$)}"]
  }
}
```

See [constraints.md](../reference/constraints.md) and [`extract`](../reference/path-patterns.md#case-transformations).

## Multi-segment placeholders with `toNthSegment`

A scoped module name like `auth-session` is split, and each segment used differently:

```json
{
  "name": "scoped-modules",
  "paths": "modules/{scopedName}/src/index.ts",
  "must": {
    "exportValues": ["${scopedName.toNthSegment(1)}"],
    "exportTypes": [
      "${scopedName.toNthSegmentPascalCase(0)}${scopedName.toNthSegmentPascalCase(1)}"
    ]
  }
}
```

For `modules/auth-session/src/index.ts`:
- `${scopedName.toNthSegment(1)}` → `session` (the export binding)
- `${scopedName.toNthSegmentPascalCase(0)}${scopedName.toNthSegmentPascalCase(1)}` → `AuthSession` (the type name)

## Excluding specific files inside a block

```json
{
  "name": "plugin-tests",
  "paths": "plugins/{pluginName}",
  "must": [
    {
      "for": { "files": "*.spec.ts" },
      "excludeFiles": ["plugins/auth/helpers.spec.ts"],
      "must": {
        "importValues": [{ "name": "createTestContext", "from": "@/test-utils" }]
      }
    }
  ]
}
```

See [`excludeFiles`](../reference/conditional-rules.md#excludefiles).
