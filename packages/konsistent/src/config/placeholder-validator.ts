import type {
  ConventionV1,
  IfConditionV1,
  MustBlockV1,
  MustPredicatesV1,
} from "./schema.js";

const USAGE_REGEX = /\$\{([a-zA-Z][a-zA-Z0-9]*)/g;
const DECLARATION_REGEX =
  /\{([a-zA-Z][a-zA-Z0-9]*)(?::[a-zA-Z][a-zA-Z0-9]*(?:\([^}]*\))?)?\}/g;

export type ValidatePlaceholdersResult =
  | { ok: true }
  | { ok: false; error: string };

export function validatePlaceholders(opts: {
  conventions: ConventionV1[];
  identifiers: string[];
}): ValidatePlaceholdersResult {
  const { conventions, identifiers } = opts;
  const errors: string[] = [];

  for (let i = 0; i < conventions.length; i += 1) {
    const convention = conventions[i];
    if (!convention) {
      continue;
    }
    const identifier = identifiers[i] ?? `conventions[${i}]`;
    const declaredFromPaths = collectDeclarations(convention.paths);

    const declared = new Set(declaredFromPaths);
    if (convention.placeholders) {
      for (const name of Object.keys(convention.placeholders)) {
        if (declaredFromPaths.has(name)) {
          errors.push(
            `Convention "${identifier}" declares placeholder "${name}" both in paths (as "{${name}}") and in placeholders. Pick one.`
          );
          continue;
        }
        declared.add(name);
      }
    }

    const usages = collectUsagesInConvention({ convention, declared });

    const reported = new Set<string>();
    for (const usage of usages) {
      if (reported.has(usage.name)) {
        continue;
      }
      reported.add(usage.name);
      errors.push(
        `Convention "${identifier}" references "\${${usage.name}}" in ${usage.key}, but neither paths nor placeholders declare "{${usage.name}}".`
      );
    }
  }

  if (errors.length === 0) {
    return { ok: true };
  }
  return { error: errors.join("\n"), ok: false };
}

function collectDeclarations(paths: string | string[]): Set<string> {
  const declared = new Set<string>();
  const entries = typeof paths === "string" ? [paths] : paths;
  for (const entry of entries) {
    addDeclarationsFromString({ into: declared, value: entry });
  }
  return declared;
}

function addDeclarationsFromString(opts: {
  value: string;
  into: Set<string>;
}): void {
  const { value, into } = opts;
  for (const match of value.matchAll(DECLARATION_REGEX)) {
    const [, name] = match;
    if (name !== undefined) {
      into.add(name);
    }
  }
}

interface Usage {
  key: string;
  name: string;
}

function collectUsagesInConvention(opts: {
  convention: ConventionV1;
  declared: Set<string>;
}): Usage[] {
  const { convention, declared } = opts;
  const usages: Usage[] = [];
  if (convention.if) {
    collectUsagesInCondition({
      condition: convention.if,
      declared,
      keyPrefix: "if",
      usages,
    });
  }
  if (convention.ifNot) {
    collectUsagesInCondition({
      condition: convention.ifNot,
      declared,
      keyPrefix: "ifNot",
      usages,
    });
  }
  usages.push(
    ...collectUsagesInAssertions({
      declaredOuter: declared,
      must: convention.must,
      mustNot: convention.mustNot,
    })
  );
  return usages;
}

function collectUsagesInCondition(opts: {
  condition: IfConditionV1;
  keyPrefix: string;
  declared: Set<string>;
  usages: Usage[];
}): void {
  const { condition, keyPrefix, declared, usages } = opts;
  if (Object.hasOwn(condition, "hasFile")) {
    pushStringUsages({
      declared,
      key: `${keyPrefix}.hasFile`,
      usages,
      value: (condition as { hasFile: string }).hasFile,
    });
  } else if (Object.hasOwn(condition, "hasDirectory")) {
    pushStringUsages({
      declared,
      key: `${keyPrefix}.hasDirectory`,
      usages,
      value: (condition as { hasDirectory: string }).hasDirectory,
    });
  } else if (Object.hasOwn(condition, "placeholderSatisfies")) {
    pushStringUsages({
      declared,
      key: `${keyPrefix}.placeholderSatisfies`,
      usages,
      value: (condition as { placeholderSatisfies: string })
        .placeholderSatisfies,
    });
  } else if (Object.hasOwn(condition, "hasValueImport")) {
    collectUsagesInDefinitionList({
      declared,
      key: `${keyPrefix}.hasValueImport`,
      list: [
        (
          condition as {
            hasValueImport: string | { name: string; from?: string };
          }
        ).hasValueImport,
      ],
      objectFields: ["name", "from"],
      usages,
    });
  } else if (Object.hasOwn(condition, "hasTypeImport")) {
    collectUsagesInDefinitionList({
      declared,
      key: `${keyPrefix}.hasTypeImport`,
      list: [
        (
          condition as {
            hasTypeImport: string | { name: string; from?: string };
          }
        ).hasTypeImport,
      ],
      objectFields: ["name", "from"],
      usages,
    });
  } else if (Object.hasOwn(condition, "hasValueImportFrom")) {
    pushStringUsages({
      declared,
      key: `${keyPrefix}.hasValueImportFrom`,
      usages,
      value: (condition as { hasValueImportFrom: string }).hasValueImportFrom,
    });
  } else if (Object.hasOwn(condition, "hasTypeImportFrom")) {
    pushStringUsages({
      declared,
      key: `${keyPrefix}.hasTypeImportFrom`,
      usages,
      value: (condition as { hasTypeImportFrom: string }).hasTypeImportFrom,
    });
  }
}

function collectUsagesInAssertions(opts: {
  must?: MustPredicatesV1 | MustBlockV1[];
  mustNot?: MustPredicatesV1;
  declaredOuter: Set<string>;
}): Usage[] {
  const { must, mustNot, declaredOuter } = opts;
  const usages: Usage[] = [];
  if (Array.isArray(must)) {
    for (const block of must) {
      collectUsagesInBlock({ block, declaredOuter, usages });
    }
  } else if (must) {
    collectUsagesInPredicates({
      declared: declaredOuter,
      predicates: must,
      prefix: "must",
      usages,
    });
  }
  if (mustNot) {
    collectUsagesInPredicates({
      declared: declaredOuter,
      predicates: mustNot,
      prefix: "mustNot",
      usages,
    });
  }
  return usages;
}

function collectUsagesInBlock(opts: {
  block: MustBlockV1;
  declaredOuter: Set<string>;
  usages: Usage[];
}): void {
  const { block, declaredOuter, usages } = opts;

  const declaredHere = new Set(declaredOuter);
  if (block.for) {
    const { files } = block.for;
    const filesArr = typeof files === "string" ? [files] : files;
    for (const f of filesArr) {
      addDeclarationsFromString({ into: declaredHere, value: f });
      pushStringUsages({
        declared: declaredOuter,
        key: "must.for.files",
        usages,
        value: f,
      });
    }
  }

  if (block.if) {
    collectUsagesInCondition({
      condition: block.if,
      declared: declaredHere,
      keyPrefix: "must.if",
      usages,
    });
  }
  if (block.ifNot) {
    collectUsagesInCondition({
      condition: block.ifNot,
      declared: declaredHere,
      keyPrefix: "must.ifNot",
      usages,
    });
  }

  if (block.excludeFiles) {
    for (const f of block.excludeFiles) {
      pushStringUsages({
        declared: declaredHere,
        key: "must.excludeFiles",
        usages,
        value: f,
      });
    }
  }

  if (block.must) {
    collectUsagesInPredicates({
      declared: declaredHere,
      predicates: block.must,
      prefix: "must",
      usages,
    });
  }
  if (block.mustNot) {
    collectUsagesInPredicates({
      declared: declaredHere,
      predicates: block.mustNot,
      prefix: "mustNot",
      usages,
    });
  }
}

function collectUsagesInPredicates(opts: {
  predicates: MustPredicatesV1;
  prefix: string;
  declared: Set<string>;
  usages: Usage[];
}): void {
  const { predicates, prefix, declared, usages } = opts;

  if (predicates.haveFiles) {
    for (const f of predicates.haveFiles) {
      pushStringUsages({
        declared,
        key: `${prefix}.haveFiles`,
        usages,
        value: f,
      });
    }
  }

  if (predicates.haveDirectories) {
    for (const directory of predicates.haveDirectories) {
      pushStringUsages({
        declared,
        key: `${prefix}.haveDirectories`,
        usages,
        value: directory,
      });
    }
  }

  collectUsagesInDefinitionList({
    declared,
    key: `${prefix}.declareTypes`,
    list: predicates.declareTypes,
    objectFields: ["name", "type"],
    schemaField: true,
    usages,
  });
  collectUsagesInDefinitionList({
    declared,
    key: `${prefix}.declareConstants`,
    list: predicates.declareConstants,
    objectFields: ["name", "type"],
    schemaField: true,
    usages,
  });
  collectUsagesInDefinitionList({
    arrayFields: ["receiveParamsOfTypes"],
    declared,
    key: `${prefix}.declareFunctions`,
    list: predicates.declareFunctions,
    objectFields: ["name", "receiveParamOfType", "returnValueOfType"],
    usages,
  });
  collectUsagesInDefinitionList({
    arrayFields: ["arguments"],
    declared,
    key: `${prefix}.callFunction`,
    list: predicates.callFunction,
    objectFields: ["name"],
    usages,
  });
  collectUsagesInDefinitionList({
    declared,
    extendField: true,
    key: `${prefix}.declareInterfaces`,
    list: predicates.declareInterfaces,
    objectFields: ["name"],
    usages,
  });
  collectUsagesInDefinitionList({
    declared,
    extendField: true,
    implementField: true,
    key: `${prefix}.declareClasses`,
    list: predicates.declareClasses,
    objectFields: ["name"],
    usages,
  });
  if (predicates.useDeclarationOrder) {
    for (const name of predicates.useDeclarationOrder) {
      pushStringUsages({
        declared,
        key: `${prefix}.useDeclarationOrder`,
        usages,
        value: name,
      });
    }
  }

  collectUsagesInDefinitionList({
    declared,
    key: `${prefix}.exportValues`,
    list: predicates.exportValues,
    objectFields: ["name", "alias", "from"],
    usages,
  });
  collectUsagesInDefinitionList({
    declared,
    key: `${prefix}.export`,
    list: predicates.export,
    objectFields: ["name", "from"],
    usages,
  });
  collectUsagesInDefinitionList({
    declared,
    key: `${prefix}.exportTypes`,
    list: predicates.exportTypes,
    objectFields: ["name", "alias", "from", "type"],
    schemaField: true,
    usages,
  });
  collectImportFromUsages({
    declared,
    key: `${prefix}.exportValuesFrom`,
    sources: predicates.exportValuesFrom,
    usages,
  });
  collectImportFromUsages({
    declared,
    key: `${prefix}.exportTypesFrom`,
    sources: predicates.exportTypesFrom,
    usages,
  });
  collectUsagesInDefinitionList({
    declared,
    key: `${prefix}.exportConstants`,
    list: predicates.exportConstants,
    objectFields: ["name", "type"],
    schemaField: true,
    usages,
  });
  collectUsagesInDefinitionList({
    arrayFields: ["receiveParamsOfTypes"],
    declared,
    key: `${prefix}.exportFunctions`,
    list: predicates.exportFunctions,
    objectFields: ["name", "receiveParamOfType", "returnValueOfType"],
    usages,
  });
  collectUsagesInDefinitionList({
    declared,
    extendField: true,
    key: `${prefix}.exportInterfaces`,
    list: predicates.exportInterfaces,
    objectFields: ["name"],
    usages,
  });
  collectUsagesInDefinitionList({
    declared,
    extendField: true,
    implementField: true,
    key: `${prefix}.exportClasses`,
    list: predicates.exportClasses,
    objectFields: ["name"],
    usages,
  });
  collectUsagesInDefinitionList({
    declared,
    key: `${prefix}.importValues`,
    list: predicates.importValues,
    objectFields: ["name", "alias", "from"],
    usages,
  });
  collectUsagesInDefinitionList({
    declared,
    key: `${prefix}.import`,
    list: predicates.import,
    objectFields: ["name", "from"],
    usages,
  });
  collectImportFromUsages({
    declared,
    key: `${prefix}.importValuesFrom`,
    sources: predicates.importValuesFrom,
    usages,
  });
  collectImportFromUsages({
    declared,
    key: `${prefix}.importTypesFrom`,
    sources: predicates.importTypesFrom,
    usages,
  });
  collectImportFromUsages({
    declared,
    key: `${prefix}.importFrom`,
    sources: predicates.importFrom,
    usages,
  });
  collectUsagesInDefinitionList({
    declared,
    key: `${prefix}.importTypes`,
    list: predicates.importTypes,
    objectFields: ["name", "alias", "from"],
    usages,
  });
}

function collectImportFromUsages(opts: {
  sources: string | string[] | undefined;
  key: string;
  declared: Set<string>;
  usages: Usage[];
}): void {
  const { sources, key, declared, usages } = opts;
  if (sources === undefined) {
    return;
  }
  const entries = typeof sources === "string" ? [sources] : sources;
  for (const source of entries) {
    pushStringUsages({ declared, key, usages, value: source });
  }
}

function collectUsagesInDefinitionList(opts: {
  list: ReadonlyArray<string | Record<string, unknown>> | undefined;
  key: string;
  objectFields: string[];
  arrayFields?: string[];
  extendField?: boolean;
  implementField?: boolean;
  schemaField?: boolean;
  declared: Set<string>;
  usages: Usage[];
}): void {
  const {
    list,
    key,
    objectFields,
    arrayFields,
    extendField,
    implementField,
    schemaField,
    declared,
    usages,
  } = opts;
  if (!list) {
    return;
  }
  for (const entry of list) {
    if (typeof entry === "string") {
      pushStringUsages({ declared, key, usages, value: entry });
      continue;
    }
    collectObjectFieldUsages({
      declared,
      entry,
      fields: objectFields,
      key,
      usages,
    });
    collectArrayFieldUsages({
      declared,
      entry,
      fields: arrayFields ?? [],
      key,
      usages,
    });
    if (extendField) {
      collectExtendUsages({ declared, key, usages, value: entry.extend });
    }
    if (implementField && Array.isArray(entry.implement)) {
      collectImplementUsages({
        declared,
        key,
        usages,
        values: entry.implement,
      });
    }
    if (schemaField) {
      collectSchemaUsages({
        declared,
        key,
        usages,
        value: entry.schema,
      });
    }
  }
}

function collectSchemaUsages(opts: {
  value: unknown;
  key: string;
  declared: Set<string>;
  usages: Usage[];
}): void {
  const { value, key, declared, usages } = opts;
  if (!(value && typeof value === "object")) {
    return;
  }

  const schema = value as Record<string, unknown>;
  if (schema.type === "array" && typeof schema.items === "string") {
    pushStringUsages({ declared, key, usages, value: schema.items });
  }
  if (
    schema.type === "object" &&
    schema.properties &&
    typeof schema.properties === "object"
  ) {
    for (const constraint of Object.values(schema.properties)) {
      if (typeof constraint === "string") {
        pushStringUsages({ declared, key, usages, value: constraint });
      }
    }
  }
}

function collectObjectFieldUsages(opts: {
  entry: Record<string, unknown>;
  fields: string[];
  key: string;
  declared: Set<string>;
  usages: Usage[];
}): void {
  const { entry, fields, key, declared, usages } = opts;
  for (const field of fields) {
    const value = entry[field];
    if (typeof value === "string") {
      pushStringUsages({ declared, key, usages, value });
    }
  }
}

function collectArrayFieldUsages(opts: {
  entry: Record<string, unknown>;
  fields: string[];
  key: string;
  declared: Set<string>;
  usages: Usage[];
}): void {
  const { entry, fields, key, declared, usages } = opts;
  for (const field of fields) {
    const value = entry[field];
    if (!Array.isArray(value)) {
      continue;
    }
    for (const item of value) {
      if (typeof item === "string") {
        pushStringUsages({ declared, key, usages, value: item });
      }
    }
  }
}

function collectImplementUsages(opts: {
  values: unknown[];
  key: string;
  declared: Set<string>;
  usages: Usage[];
}): void {
  const { values, key, declared, usages } = opts;
  for (const item of values) {
    collectExtendUsages({ declared, key, usages, value: item });
  }
}

function collectExtendUsages(opts: {
  value: unknown;
  key: string;
  declared: Set<string>;
  usages: Usage[];
}): void {
  const { value, key, declared, usages } = opts;
  if (typeof value === "string") {
    pushStringUsages({ declared, key, usages, value });
    return;
  }
  if (
    value &&
    typeof value === "object" &&
    Object.hasOwn(value, "type") &&
    typeof (value as { type: unknown }).type === "string"
  ) {
    pushStringUsages({
      declared,
      key,
      usages,
      value: (value as { type: string }).type,
    });
  }
}

function pushStringUsages(opts: {
  value: string;
  key: string;
  declared: Set<string>;
  usages: Usage[];
}): void {
  const { value, key, declared, usages } = opts;
  for (const match of value.matchAll(USAGE_REGEX)) {
    const [, name] = match;
    if (name !== undefined && !declared.has(name)) {
      usages.push({ key, name });
    }
  }
}
