# Predicate Reference

Reference the JSON schema at `node_modules/konsistent/konsistent.schema.json` for the authoritative list of predicates and their shapes. Below is a summary of all predicates available in the `must` object.

## Filesystem Predicates

### haveType

Validate whether a path is a file or directory.

```json
"must": { "haveType": "directory" }
```

Values: `"file"` or `"directory"`.

### haveFiles

Check that specific files exist within a matched directory.

```json
"must": { "haveFiles": ["index.ts", "README.md"] }
```

Supports templates: `"haveFiles": ["src/${name}-provider.ts"]`

## TypeScript Export Predicates

All export predicates accept `(string | { name: string, ...options })[]`.

### export

Check for named value exports (functions, classes, constants — anything that's not a type-only export).

```json
"must": { "export": ["myFunction", "${name}"] }
```

### exportTypes

Check for type-only exports (`type` or `interface` exported as types).

```json
"must": { "exportTypes": ["${name.toPascalCase()}Config"] }
```

### exportConstants

Check for `const` exports specifically.

```json
"must": { "exportConstants": ["pluginId", "DEFAULT_CONFIG"] }
```

### exportFunctions

Check for function exports. Supports optional type signature validation.

```json
"must": {
  "exportFunctions": [
    {
      "name": "create${name.toPascalCase()}Service",
      "receiveParamOfType": "${name.toPascalCase()}Config",
      "returnValueOfType": "${name.toPascalCase()}Service"
    }
  ]
}
```

Options:
- `receiveParamOfType`: type name the first parameter must have
- `returnValueOfType`: type name the return value must have

### exportInterfaces

Check for interface exports with optional inheritance validation.

```json
"must": {
  "exportInterfaces": [
    { "name": "${name.toPascalCase()}Provider", "extend": "BaseProvider" }
  ]
}
```

Options:
- `extend`: base interface name the interface must extend

### exportClasses

Check for class exports with optional inheritance and interface implementation validation.

```json
"must": {
  "exportClasses": [
    {
      "name": "${name.toPascalCase()}Adapter",
      "extend": "BaseAdapter",
      "implement": ["Connectable", "Disposable"]
    }
  ]
}
```

Options:
- `extend`: base class name the class must extend
- `implement`: array of interface names the class must implement. Each entry can be a string or `{ "type": "InterfaceName", "allowOmissions": true }`

## TypeScript Import Predicates

### import

Check for named value imports.

```json
"must": { "import": [{ "name": "React", "from": "react" }] }
```

Options:
- `from`: module specifier to verify import source

### importTypes

Check for type-only imports.

```json
"must": {
  "importTypes": [{ "name": "ProviderV1", "from": "@ai-toolkit/core" }]
}
```

Options:
- `from`: module specifier to verify import source
