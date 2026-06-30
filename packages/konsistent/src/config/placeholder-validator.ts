import type { ConventionV1, MustBlockV1, MustPredicatesV1 } from "./schema.js";

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

  for (let i = 0; i < conventions.length; i++) {
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

    const usages = collectUsagesInAssertions({
      must: convention.must,
      mustNot: convention.mustNot,
      declaredOuter: declared,
    });

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
  return { ok: false, error: errors.join("\n") };
}

function collectDeclarations(paths: string | string[]): Set<string> {
  const declared = new Set<string>();
  const entries = typeof paths === "string" ? [paths] : paths;
  for (const entry of entries) {
    addDeclarationsFromString({ value: entry, into: declared });
  }
  return declared;
}

function addDeclarationsFromString(opts: {
  value: string;
  into: Set<string>;
}): void {
  const { value, into } = opts;
  for (const match of value.matchAll(DECLARATION_REGEX)) {
    const name = match[1];
    if (name !== undefined) {
      into.add(name);
    }
  }
}

interface Usage {
  key: string;
  name: string;
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
      predicates: must,
      prefix: "must",
      declared: declaredOuter,
      usages,
    });
  }
  if (mustNot) {
    collectUsagesInPredicates({
      predicates: mustNot,
      prefix: "mustNot",
      declared: declaredOuter,
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
    const files = block.for.files;
    const filesArr = typeof files === "string" ? [files] : files;
    for (const f of filesArr) {
      addDeclarationsFromString({ value: f, into: declaredHere });
      pushStringUsages({
        value: f,
        key: "must.for.files",
        declared: declaredOuter,
        usages,
      });
    }
  }

  if (block.if) {
    if (Object.hasOwn(block.if, "hasFile")) {
      pushStringUsages({
        value: (block.if as { hasFile: string }).hasFile,
        key: "must.if.hasFile",
        declared: declaredHere,
        usages,
      });
    } else if (Object.hasOwn(block.if, "placeholderSatisfies")) {
      pushStringUsages({
        value: (block.if as { placeholderSatisfies: string })
          .placeholderSatisfies,
        key: "must.if.placeholderSatisfies",
        declared: declaredHere,
        usages,
      });
    }
  }

  if (block.excludeFiles) {
    for (const f of block.excludeFiles) {
      pushStringUsages({
        value: f,
        key: "must.excludeFiles",
        declared: declaredHere,
        usages,
      });
    }
  }

  if (block.must) {
    collectUsagesInPredicates({
      predicates: block.must,
      prefix: "must",
      declared: declaredHere,
      usages,
    });
  }
  if (block.mustNot) {
    collectUsagesInPredicates({
      predicates: block.mustNot,
      prefix: "mustNot",
      declared: declaredHere,
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
        value: f,
        key: `${prefix}.haveFiles`,
        declared,
        usages,
      });
    }
  }

  collectUsagesInDefinitionList({
    list: predicates.declareTypes,
    key: `${prefix}.declareTypes`,
    objectFields: ["name"],
    declared,
    usages,
  });
  collectUsagesInDefinitionList({
    list: predicates.declareConstants,
    key: `${prefix}.declareConstants`,
    objectFields: ["name"],
    declared,
    usages,
  });
  collectUsagesInDefinitionList({
    list: predicates.declareFunctions,
    key: `${prefix}.declareFunctions`,
    objectFields: ["name", "receiveParamOfType", "returnValueOfType"],
    arrayFields: ["receiveParamsOfTypes"],
    declared,
    usages,
  });
  collectUsagesInDefinitionList({
    list: predicates.declareInterfaces,
    key: `${prefix}.declareInterfaces`,
    objectFields: ["name"],
    extendField: true,
    declared,
    usages,
  });
  collectUsagesInDefinitionList({
    list: predicates.declareClasses,
    key: `${prefix}.declareClasses`,
    objectFields: ["name"],
    extendField: true,
    implementField: true,
    declared,
    usages,
  });
  if (predicates.useDeclarationOrder) {
    for (const name of predicates.useDeclarationOrder) {
      pushStringUsages({
        value: name,
        key: `${prefix}.useDeclarationOrder`,
        declared,
        usages,
      });
    }
  }

  collectUsagesInDefinitionList({
    list: predicates.export,
    key: `${prefix}.export`,
    objectFields: ["name", "from"],
    declared,
    usages,
  });
  collectUsagesInDefinitionList({
    list: predicates.exportTypes,
    key: `${prefix}.exportTypes`,
    objectFields: ["name", "from"],
    declared,
    usages,
  });
  collectUsagesInDefinitionList({
    list: predicates.exportConstants,
    key: `${prefix}.exportConstants`,
    objectFields: ["name", "from"],
    declared,
    usages,
  });
  collectUsagesInDefinitionList({
    list: predicates.exportFunctions,
    key: `${prefix}.exportFunctions`,
    objectFields: ["name", "receiveParamOfType", "returnValueOfType"],
    arrayFields: ["receiveParamsOfTypes"],
    declared,
    usages,
  });
  collectUsagesInDefinitionList({
    list: predicates.exportInterfaces,
    key: `${prefix}.exportInterfaces`,
    objectFields: ["name"],
    extendField: true,
    declared,
    usages,
  });
  collectUsagesInDefinitionList({
    list: predicates.exportClasses,
    key: `${prefix}.exportClasses`,
    objectFields: ["name"],
    extendField: true,
    implementField: true,
    declared,
    usages,
  });
  collectUsagesInDefinitionList({
    list: predicates.import,
    key: `${prefix}.import`,
    objectFields: ["name", "from"],
    declared,
    usages,
  });
  if (predicates.importFrom) {
    pushStringUsages({
      value: predicates.importFrom,
      key: `${prefix}.importFrom`,
      declared,
      usages,
    });
  }
  collectUsagesInDefinitionList({
    list: predicates.importTypes,
    key: `${prefix}.importTypes`,
    objectFields: ["name", "from"],
    declared,
    usages,
  });
}

function collectUsagesInDefinitionList(opts: {
  list: ReadonlyArray<string | Record<string, unknown>> | undefined;
  key: string;
  objectFields: string[];
  arrayFields?: string[];
  extendField?: boolean;
  implementField?: boolean;
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
    declared,
    usages,
  } = opts;
  if (!list) {
    return;
  }
  for (const entry of list) {
    if (typeof entry === "string") {
      pushStringUsages({ value: entry, key, declared, usages });
      continue;
    }
    collectObjectFieldUsages({
      entry,
      fields: objectFields,
      key,
      declared,
      usages,
    });
    collectArrayFieldUsages({
      entry,
      fields: arrayFields ?? [],
      key,
      declared,
      usages,
    });
    if (extendField) {
      collectExtendUsages({ value: entry.extend, key, declared, usages });
    }
    if (implementField && Array.isArray(entry.implement)) {
      collectImplementUsages({
        values: entry.implement,
        key,
        declared,
        usages,
      });
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
      pushStringUsages({ value, key, declared, usages });
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
        pushStringUsages({ value: item, key, declared, usages });
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
    collectExtendUsages({ value: item, key, declared, usages });
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
    pushStringUsages({ value, key, declared, usages });
    return;
  }
  if (
    value &&
    typeof value === "object" &&
    Object.hasOwn(value, "type") &&
    typeof (value as { type: unknown }).type === "string"
  ) {
    pushStringUsages({
      value: (value as { type: string }).type,
      key,
      declared,
      usages,
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
    const name = match[1];
    if (name !== undefined && !declared.has(name)) {
      usages.push({ name, key });
    }
  }
}
