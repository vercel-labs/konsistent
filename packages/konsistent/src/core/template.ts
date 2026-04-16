import type { PlaceholderValue } from './placeholder.js';

const TEMPLATE_REGEX = /\$\{(\w+)(?:\.(\w+)\((\d+)?\))?\}/g;

const VALID_METHODS = new Set([
  'toString',
  'toPascalCase',
  'toCamelCase',
  'toKebabCase',
  'toSnakeCase',
  'toNthSegment',
  'toNthSegmentPascalCase',
  'toNthSegmentCamelCase',
]);

export function resolveTemplate(opts: {
  template: string;
  placeholders: Record<string, PlaceholderValue>;
}): string {
  const { template, placeholders } = opts;

  return template.replace(TEMPLATE_REGEX, (original, name, method, arg) => {
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

    if (arg !== undefined) {
      return (placeholder as unknown as Record<string, (n: number) => string>)[
        method
      ](Number(arg));
    }

    return (placeholder as unknown as Record<string, () => string>)[method]();
  });
}
