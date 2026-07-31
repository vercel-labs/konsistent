import type { ConfigV1, MustBlockV1, MustPredicatesV1 } from "./schema.js";

const DEPRECATED_PREDICATES = [
  { name: "export", replacement: 'Use "exportValues" instead.' },
  { name: "import", replacement: 'Use "importValues" instead.' },
  {
    name: "importFrom",
    replacement: 'Use "importValuesFrom" or "importTypesFrom" instead.',
  },
  {
    name: "importFromCurrentDir",
    replacement: 'Use "importValuesFromCurrentDir" instead.',
  },
  {
    name: "importFromParents",
    replacement: 'Use "importValuesFromParents" instead.',
  },
  {
    name: "importFromExternals",
    replacement: 'Use "importValuesFromExternals" instead.',
  },
] as const satisfies ReadonlyArray<{
  name: keyof MustPredicatesV1;
  replacement: string;
}>;

export function collectDeprecationWarnings(opts: {
  config: ConfigV1;
}): string[] {
  const warnings: string[] = [];
  for (const [index, convention] of opts.config.conventions.entries()) {
    const prefix = `conventions[${index}]`;
    if (Array.isArray(convention.must)) {
      for (const [blockIndex, block] of convention.must.entries()) {
        collectBlockWarnings({
          block,
          path: `${prefix}.must[${blockIndex}]`,
          warnings,
        });
      }
    } else {
      collectPredicateWarnings({
        predicates: convention.must,
        path: `${prefix}.must`,
        warnings,
      });
    }
    collectPredicateWarnings({
      predicates: convention.mustNot,
      path: `${prefix}.mustNot`,
      warnings,
    });
  }
  return warnings;
}

function collectBlockWarnings(opts: {
  block: MustBlockV1;
  path: string;
  warnings: string[];
}): void {
  const { block, path, warnings } = opts;
  collectPredicateWarnings({
    predicates: block.must,
    path: `${path}.must`,
    warnings,
  });
  collectPredicateWarnings({
    predicates: block.mustNot,
    path: `${path}.mustNot`,
    warnings,
  });
}

function collectPredicateWarnings(opts: {
  predicates: MustPredicatesV1 | undefined;
  path: string;
  warnings: string[];
}): void {
  const { predicates, path, warnings } = opts;
  if (!predicates) {
    return;
  }
  for (const deprecated of DEPRECATED_PREDICATES) {
    if (Object.hasOwn(predicates, deprecated.name)) {
      warnings.push(
        `Warning: "${deprecated.name}" is deprecated in ${path}.${deprecated.name}. ${deprecated.replacement}`
      );
    }
  }
  collectFunctionWarnings({
    list: predicates.declareFunctions,
    path: `${path}.declareFunctions`,
    warnings,
  });
  collectFunctionWarnings({
    list: predicates.exportFunctions,
    path: `${path}.exportFunctions`,
    warnings,
  });
}

function collectFunctionWarnings(opts: {
  list: MustPredicatesV1["declareFunctions"] | undefined;
  path: string;
  warnings: string[];
}): void {
  const { list, path, warnings } = opts;
  if (!list) {
    return;
  }
  for (const [index, entry] of list.entries()) {
    if (
      typeof entry === "object" &&
      entry !== null &&
      Object.hasOwn(entry, "receiveParamOfType")
    ) {
      warnings.push(
        `Warning: "receiveParamOfType" is deprecated in ${path}[${index}].receiveParamOfType. ` +
          'Use "receiveParamsOfTypes" instead.'
      );
    }
  }
}
