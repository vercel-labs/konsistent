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

function getItemName(item: string | { name: string }): string {
  return typeof item === "string" ? item : item.name;
}

const PREDICATE_RULES: Record<
  string,
  (opts: { items: unknown[]; negated: boolean; predicateKey: string }) => string
> = {
  haveType: ({ items, negated }) =>
    negated ? `must-not-be-${items[0]}` : `must-be-${items[0]}`,
  haveFiles: ({ items, negated }) => {
    const first = items[0] as string;
    const stripped = stripTemplateExpressions(first);
    const kebab = fileToKebab(stripped);
    const prefix = negated ? "must-not-have" : "must-have";
    return kebab ? `${prefix}-${kebab}` : prefix;
  },
  declareTypes: ({ items, negated }) => {
    const kebab = deriveKebabFromName(
      getItemName(items[0] as string | { name: string })
    );
    const prefix = negated ? "must-not-declare" : "must-declare";
    return kebab ? `${prefix}-${kebab}-type` : `${prefix}-type`;
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
  declareClasses: ({ items, negated }) => {
    const kebab = deriveKebabFromName(
      getItemName(items[0] as string | { name: string })
    );
    const prefix = negated ? "must-not-declare" : "must-declare";
    return kebab ? `${prefix}-${kebab}-class` : `${prefix}-class`;
  },
  declareInterfaces: ({ items, negated }) => {
    const kebab = deriveKebabFromName(
      getItemName(items[0] as string | { name: string })
    );
    const prefix = negated ? "must-not-declare" : "must-declare";
    return kebab ? `${prefix}-${kebab}-interface` : `${prefix}-interface`;
  },
  export: ({ items, negated }) => {
    const kebab = deriveKebabFromName(getItemName(items[0] as string));
    const prefix = negated ? "must-not-export" : "must-export";
    return kebab ? `${prefix}-${kebab}` : prefix;
  },
  exportTypes: ({ items, negated }) => {
    const kebab = deriveKebabFromName(
      getItemName(items[0] as string | { name: string })
    );
    const prefix = negated ? "must-not-export" : "must-export";
    return kebab ? `${prefix}-${kebab}-type` : `${prefix}-type`;
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
  exportClasses: ({ items, negated }) => {
    const kebab = deriveKebabFromName(
      getItemName(items[0] as string | { name: string })
    );
    const prefix = negated ? "must-not-export" : "must-export";
    return kebab ? `${prefix}-${kebab}-class` : `${prefix}-class`;
  },
  exportInterfaces: ({ items, negated }) => {
    const kebab = deriveKebabFromName(
      getItemName(items[0] as string | { name: string })
    );
    const prefix = negated ? "must-not-export" : "must-export";
    return kebab ? `${prefix}-${kebab}-interface` : `${prefix}-interface`;
  },
  import: ({ items, negated }) => {
    const kebab = deriveKebabFromName(
      getItemName(items[0] as string | { name: string })
    );
    const prefix = negated ? "must-not-import" : "must-import";
    return kebab ? `${prefix}-${kebab}` : prefix;
  },
  importTypes: ({ items, negated }) => {
    const kebab = deriveKebabFromName(
      getItemName(items[0] as string | { name: string })
    );
    const prefix = negated ? "must-not-import" : "must-import";
    return kebab ? `${prefix}-${kebab}-type` : `${prefix}-type`;
  },
  importFromCurrentDir: ({ items, negated }) =>
    (items[0] === false) === negated
      ? "must-import-from-current-dir"
      : "must-not-import-from-current-dir",
  importFromParents: ({ items, negated }) =>
    (items[0] === false) === negated
      ? "must-import-from-parents"
      : "must-not-import-from-parents",
  importFromExternals: ({ items, negated }) =>
    (items[0] === false) === negated
      ? "must-import-from-externals"
      : "must-not-import-from-externals",
  importTypesFromCurrentDir: ({ items, negated }) =>
    (items[0] === false) === negated
      ? "must-import-type-from-current-dir"
      : "must-not-import-type-from-current-dir",
  importTypesFromParents: ({ items, negated }) =>
    (items[0] === false) === negated
      ? "must-import-type-from-parents"
      : "must-not-import-type-from-parents",
  importTypesFromExternals: ({ items, negated }) =>
    (items[0] === false) === negated
      ? "must-import-type-from-externals"
      : "must-not-import-type-from-externals",
  useDeclarationOrder: ({ items, negated }) => {
    const kebab = deriveKebabFromName(items[0] as string);
    const prefix = negated ? "must-not-use" : "must-use";
    return kebab
      ? `${prefix}-${kebab}-declaration-order`
      : `${prefix}-declaration-order`;
  },
};

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

  const predicateKeys = Object.keys(selected).filter(
    (k) => selected[k as keyof MustPredicatesV1] != null
  );

  if (predicateKeys.length === 0) {
    return "convention";
  }

  const firstKey = predicateKeys[0];
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
