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
  (opts: { items: unknown[]; predicateKey: string }) => string
> = {
  haveType: ({ items }) => `must-be-${items[0]}`,
  haveFiles: ({ items }) => {
    const first = items[0] as string;
    const stripped = stripTemplateExpressions(first);
    const kebab = fileToKebab(stripped);
    return kebab ? `must-have-${kebab}` : "must-have";
  },
  export: ({ items }) => {
    const kebab = deriveKebabFromName(getItemName(items[0] as string));
    return kebab ? `must-export-${kebab}` : "must-export";
  },
  exportTypes: ({ items }) => {
    const kebab = deriveKebabFromName(
      getItemName(items[0] as string | { name: string })
    );
    return kebab ? `must-export-${kebab}-type` : "must-export-type";
  },
  exportConstants: ({ items }) => {
    const kebab = deriveKebabFromName(
      getItemName(items[0] as string | { name: string })
    );
    return kebab ? `must-export-${kebab}-constant` : "must-export-constant";
  },
  exportFunctions: ({ items }) => {
    const kebab = deriveKebabFromName(
      getItemName(items[0] as string | { name: string })
    );
    return kebab ? `must-export-${kebab}-function` : "must-export-function";
  },
  exportClasses: ({ items }) => {
    const kebab = deriveKebabFromName(
      getItemName(items[0] as string | { name: string })
    );
    return kebab ? `must-export-${kebab}-class` : "must-export-class";
  },
  exportInterfaces: ({ items }) => {
    const kebab = deriveKebabFromName(
      getItemName(items[0] as string | { name: string })
    );
    return kebab ? `must-export-${kebab}-interface` : "must-export-interface";
  },
  import: ({ items }) => {
    const kebab = deriveKebabFromName(
      getItemName(items[0] as string | { name: string })
    );
    return kebab ? `must-import-${kebab}` : "must-import";
  },
  importTypes: ({ items }) => {
    const kebab = deriveKebabFromName(
      getItemName(items[0] as string | { name: string })
    );
    return kebab ? `must-import-${kebab}-type` : "must-import-type";
  },
};

export function generateConventionName(opts: {
  must: MustPredicatesV1 | MustBlockV1[];
}): string {
  const mustObj: MustPredicatesV1 = Array.isArray(opts.must)
    ? opts.must[0].must
    : opts.must;

  const predicateKeys = Object.keys(mustObj).filter(
    (k) => mustObj[k as keyof MustPredicatesV1] != null
  );

  if (predicateKeys.length === 0) {
    return "convention";
  }

  const firstKey = predicateKeys[0];
  const firstValue = mustObj[firstKey as keyof MustPredicatesV1];

  const rule = PREDICATE_RULES[firstKey];
  if (!rule) {
    return "convention";
  }

  const items = Array.isArray(firstValue) ? firstValue : [firstValue];
  let name = rule({ items, predicateKey: firstKey });

  const needsAndMore =
    predicateKeys.length > 1 || (Array.isArray(firstValue) && items.length > 1);

  if (needsAndMore) {
    name += "-and-more";
  }

  return name;
}
