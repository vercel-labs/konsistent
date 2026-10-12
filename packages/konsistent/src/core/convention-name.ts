import type { MustBlockV1, MustPredicatesV1 } from "../config/schema.js";

function stripTemplateExpressions(name: string): string {
  return name.replace(/\$\{[^}]*\}/g, "");
}

function camelToKebab(str: string): string {
  return str.replace(/([a-z0-9])([A-Z])/g, "$1-$2").toLowerCase();
}

function deriveKebabFromName(name: string): string {
  const stripped = stripTemplateExpressions(name);
  const kebab = camelToKebab(stripped);
  return kebab.replace(/-{2,}/g, "-").replace(/^-+|-+$/g, "");
}

function fileToKebab(file: string): string {
  return file.replace(/[./]/g, "-").replace(/^-+|-+$/g, "");
}

function sourceToKebab(source: string): string {
  const stripped = stripTemplateExpressions(source);
  return stripped
    .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .toLowerCase()
    .replace(/-{2,}/g, "-")
    .replace(/^-+|-+$/g, "");
}

function getItemName(item: string | { name: string }): string {
  return typeof item === "string" ? item : item.name;
}

const PREDICATE_RULES: Record<
  string,
  (opts: { items: unknown[]; negated: boolean; predicateKey: string }) => string
> = {
  declareClasses: ({ items, negated }) => {
    const kebab = deriveKebabFromName(
      getItemName(items[0] as string | { name: string })
    );
    const prefix = negated ? "must-not-declare" : "must-declare";
    return kebab ? `${prefix}-${kebab}-class` : `${prefix}-class`;
  },
  declareConstants: ({ items, negated }) => {
    const kebab = deriveKebabFromName(
      getItemName(items[0] as string | { name: string })
    );
    const prefix = negated ? "must-not-declare" : "must-declare";
    return kebab ? `${prefix}-${kebab}-constant` : `${prefix}-constant`;
  },
  declareFunctions: ({ items, negated }) => {
    const kebab = deriveKebabFromName(
      getItemName(items[0] as string | { name: string })
    );
    const prefix = negated ? "must-not-declare" : "must-declare";
    return kebab ? `${prefix}-${kebab}-function` : `${prefix}-function`;
  },
  declareInterfaces: ({ items, negated }) => {
    const kebab = deriveKebabFromName(
      getItemName(items[0] as string | { name: string })
    );
    const prefix = negated ? "must-not-declare" : "must-declare";
    return kebab ? `${prefix}-${kebab}-interface` : `${prefix}-interface`;
  },
  declareTypes: ({ items, negated }) => {
    const kebab = deriveKebabFromName(
      getItemName(items[0] as string | { name: string })
    );
    const prefix = negated ? "must-not-declare" : "must-declare";
    return kebab ? `${prefix}-${kebab}-type` : `${prefix}-type`;
  },
  export: ({ items, negated }) => {
    const kebab = deriveKebabFromName(getItemName(items[0] as string));
    const prefix = negated ? "must-not-export" : "must-export";
    return kebab ? `${prefix}-${kebab}` : prefix;
  },
  exportClasses: ({ items, negated }) => {
    const kebab = deriveKebabFromName(
      getItemName(items[0] as string | { name: string })
    );
    const prefix = negated ? "must-not-export" : "must-export";
    return kebab ? `${prefix}-${kebab}-class` : `${prefix}-class`;
  },
  exportConstants: ({ items, negated }) => {
    const kebab = deriveKebabFromName(
      getItemName(items[0] as string | { name: string })
    );
    const prefix = negated ? "must-not-export" : "must-export";
    return kebab ? `${prefix}-${kebab}-constant` : `${prefix}-constant`;
  },
  exportFunctions: ({ items, negated }) => {
    const kebab = deriveKebabFromName(
      getItemName(items[0] as string | { name: string })
    );
    const prefix = negated ? "must-not-export" : "must-export";
    return kebab ? `${prefix}-${kebab}-function` : `${prefix}-function`;
  },
  exportInterfaces: ({ items, negated }) => {
    const kebab = deriveKebabFromName(
      getItemName(items[0] as string | { name: string })
    );
    const prefix = negated ? "must-not-export" : "must-export";
    return kebab ? `${prefix}-${kebab}-interface` : `${prefix}-interface`;
  },
  exportTypes: ({ items, negated }) => {
    const kebab = deriveKebabFromName(
      getItemName(items[0] as string | { name: string })
    );
    const prefix = negated ? "must-not-export" : "must-export";
    return kebab ? `${prefix}-${kebab}-type` : `${prefix}-type`;
  },
  exportTypesFrom: ({ items, negated }) => {
    const kebab = sourceToKebab(items[0] as string);
    const prefix = negated
      ? "must-not-export-type-from"
      : "must-export-type-from";
    return kebab ? `${prefix}-${kebab}` : prefix;
  },
  exportTypesFromCurrentDir: ({ items, negated }) =>
    (items[0] === false) === negated
      ? "must-export-type-from-current-dir"
      : "must-not-export-type-from-current-dir",
  exportTypesFromExternals: ({ items, negated }) =>
    (items[0] === false) === negated
      ? "must-export-type-from-externals"
      : "must-not-export-type-from-externals",
  exportTypesFromParents: ({ items, negated }) =>
    (items[0] === false) === negated
      ? "must-export-type-from-parents"
      : "must-not-export-type-from-parents",
  exportValues: ({ items, negated }) => {
    const kebab = deriveKebabFromName(getItemName(items[0] as string));
    const prefix = negated ? "must-not-export" : "must-export";
    return kebab ? `${prefix}-${kebab}` : prefix;
  },
  exportValuesFrom: ({ items, negated }) => {
    const kebab = sourceToKebab(items[0] as string);
    const prefix = negated ? "must-not-export-from" : "must-export-from";
    return kebab ? `${prefix}-${kebab}` : prefix;
  },
  exportValuesFromCurrentDir: ({ items, negated }) =>
    (items[0] === false) === negated
      ? "must-export-from-current-dir"
      : "must-not-export-from-current-dir",
  exportValuesFromExternals: ({ items, negated }) =>
    (items[0] === false) === negated
      ? "must-export-from-externals"
      : "must-not-export-from-externals",
  exportValuesFromParents: ({ items, negated }) =>
    (items[0] === false) === negated
      ? "must-export-from-parents"
      : "must-not-export-from-parents",
  haveDirectories: ({ items, negated }) => {
    const first = items[0] as string;
    const kebab = fileToKebab(stripTemplateExpressions(first));
    const prefix = negated ? "must-not-have" : "must-have";
    return kebab ? `${prefix}-${kebab}-directory` : `${prefix}-directory`;
  },
  haveFiles: ({ items, negated }) => {
    const first = items[0] as string;
    const stripped = stripTemplateExpressions(first);
    const kebab = fileToKebab(stripped);
    const prefix = negated ? "must-not-have" : "must-have";
    return kebab ? `${prefix}-${kebab}` : prefix;
  },
  haveType: ({ items, negated }) =>
    negated ? `must-not-be-${items[0]}` : `must-be-${items[0]}`,
  import: ({ items, negated }) => {
    const kebab = deriveKebabFromName(
      getItemName(items[0] as string | { name: string })
    );
    const prefix = negated ? "must-not-import" : "must-import";
    return kebab ? `${prefix}-${kebab}` : prefix;
  },
  importFrom: ({ items, negated }) => {
    const kebab = sourceToKebab(items[0] as string);
    const prefix = negated ? "must-not-import-from" : "must-import-from";
    return kebab ? `${prefix}-${kebab}` : prefix;
  },
  importFromCurrentDir: ({ items, negated }) =>
    (items[0] === false) === negated
      ? "must-import-from-current-dir"
      : "must-not-import-from-current-dir",
  importFromExternals: ({ items, negated }) =>
    (items[0] === false) === negated
      ? "must-import-from-externals"
      : "must-not-import-from-externals",
  importFromParents: ({ items, negated }) =>
    (items[0] === false) === negated
      ? "must-import-from-parents"
      : "must-not-import-from-parents",
  importTypes: ({ items, negated }) => {
    const kebab = deriveKebabFromName(
      getItemName(items[0] as string | { name: string })
    );
    const prefix = negated ? "must-not-import" : "must-import";
    return kebab ? `${prefix}-${kebab}-type` : `${prefix}-type`;
  },
  importTypesFrom: ({ items, negated }) => {
    const kebab = sourceToKebab(items[0] as string);
    const prefix = negated
      ? "must-not-import-type-from"
      : "must-import-type-from";
    return kebab ? `${prefix}-${kebab}` : prefix;
  },
  importTypesFromCurrentDir: ({ items, negated }) =>
    (items[0] === false) === negated
      ? "must-import-type-from-current-dir"
      : "must-not-import-type-from-current-dir",
  importTypesFromExternals: ({ items, negated }) =>
    (items[0] === false) === negated
      ? "must-import-type-from-externals"
      : "must-not-import-type-from-externals",
  importTypesFromParents: ({ items, negated }) =>
    (items[0] === false) === negated
      ? "must-import-type-from-parents"
      : "must-not-import-type-from-parents",
  importValues: ({ items, negated }) => {
    const kebab = deriveKebabFromName(
      getItemName(items[0] as string | { name: string })
    );
    const prefix = negated ? "must-not-import" : "must-import";
    return kebab ? `${prefix}-${kebab}` : prefix;
  },
  importValuesFrom: ({ items, negated }) => {
    const kebab = sourceToKebab(items[0] as string);
    const prefix = negated ? "must-not-import-from" : "must-import-from";
    return kebab ? `${prefix}-${kebab}` : prefix;
  },
  importValuesFromCurrentDir: ({ items, negated }) =>
    (items[0] === false) === negated
      ? "must-import-from-current-dir"
      : "must-not-import-from-current-dir",
  importValuesFromExternals: ({ items, negated }) =>
    (items[0] === false) === negated
      ? "must-import-from-externals"
      : "must-not-import-from-externals",
  importValuesFromParents: ({ items, negated }) =>
    (items[0] === false) === negated
      ? "must-import-from-parents"
      : "must-not-import-from-parents",
  useDeclarationOrder: ({ items, negated }) => {
    const kebab = deriveKebabFromName(items[0] as string);
    const prefix = negated ? "must-not-use" : "must-use";
    return kebab
      ? `${prefix}-${kebab}-declaration-order`
      : `${prefix}-declaration-order`;
  },
};

const PREDICATE_PRIORITY = [
  "haveType",
  "haveFiles",
  "haveDirectories",
  "declareTypes",
  "declareConstants",
  "declareFunctions",
  "callFunction",
  "declareInterfaces",
  "declareClasses",
  "exportValues",
  "export",
  "exportTypes",
  "exportValuesFrom",
  "exportTypesFrom",
  "exportValuesFromCurrentDir",
  "exportValuesFromParents",
  "exportValuesFromExternals",
  "exportTypesFromCurrentDir",
  "exportTypesFromParents",
  "exportTypesFromExternals",
  "exportConstants",
  "exportFunctions",
  "exportInterfaces",
  "exportClasses",
  "importValues",
  "import",
  "importValuesFrom",
  "importTypesFrom",
  "importFrom",
  "importTypes",
  "importValuesFromCurrentDir",
  "importFromCurrentDir",
  "importValuesFromParents",
  "importFromParents",
  "importValuesFromExternals",
  "importFromExternals",
  "importTypesFromCurrentDir",
  "importTypesFromParents",
  "importTypesFromExternals",
  "useDeclarationOrder",
  "areBarrelFiles",
] satisfies readonly (keyof MustPredicatesV1)[];

export function generateConventionName(opts: {
  must?: MustPredicatesV1 | MustBlockV1[];
  mustNot?: MustPredicatesV1;
}): string {
  const firstBlock = Array.isArray(opts.must) ? opts.must[0] : undefined;
  let selected: MustPredicatesV1 | undefined;
  let negated = false;
  if (Array.isArray(opts.must)) {
    if (firstBlock?.must) {
      selected = firstBlock.must;
    } else if (firstBlock?.mustNot) {
      selected = firstBlock.mustNot;
      negated = true;
    }
  } else if (opts.must) {
    selected = opts.must;
  }
  if (!selected && opts.mustNot) {
    selected = opts.mustNot;
    negated = true;
  }

  if (!selected) {
    return "convention";
  }

  const predicateKeys = PREDICATE_PRIORITY.filter(
    (key) => selected[key] !== undefined
  );

  const [firstKey] = predicateKeys;
  if (firstKey === undefined) {
    return "convention";
  }

  const firstValue = selected[firstKey as keyof MustPredicatesV1];

  const rule = PREDICATE_RULES[firstKey];
  if (!rule) {
    return "convention";
  }

  const items = Array.isArray(firstValue) ? firstValue : [firstValue];
  let name = rule({ items, negated, predicateKey: firstKey });

  const needsAndMore =
    predicateKeys.length > 1 || (Array.isArray(firstValue) && items.length > 1);

  if (needsAndMore) {
    name += "-and-more";
  }

  return name;
}
