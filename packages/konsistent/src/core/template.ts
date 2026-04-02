import type { PlaceholderValue } from './placeholder.js';

const TEMPLATE_REGEX = /\$\{(\w+)(?:\.(\w+)\(\))?\}/g;

const VALID_METHODS = new Set([
  'toString',
  'toPascalCase',
  'toCamelCase',
  'toKebabCase',
  'toSnakeCase',
]);

export function resolveTemplate(opts: {
  template: string;
  placeholders: Record<string, PlaceholderValue>;
}): string {
  const { template, placeholders } = opts;

  return template.replace(TEMPLATE_REGEX, (original, name, method) => {
    const placeholder = placeholders[name];
    if (!placeholder) {
      return original;
    }

    if (!method) {
      return placeholder.toString();
    }

    if (!VALID_METHODS.has(method)) {
      return original;
    }

    return (placeholder as unknown as Record<string, () => string>)[method]();
  });
}
