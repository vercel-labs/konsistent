import type { PlaceholderValue } from "./placeholder.js";

const TEMPLATE_REGEX = /\$\{(\w+)(?:\.(\w+)\(([^}]*)\))?\}/g;

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

    switch (method) {
      case "toString":
        return placeholder.toString();
      case "toPascalCase":
        return placeholder.toPascalCase();
      case "toCamelCase":
        return placeholder.toCamelCase();
      case "toKebabCase":
        return placeholder.toKebabCase();
      case "toSnakeCase":
        return placeholder.toSnakeCase();
      case "toFlatCase":
        return placeholder.toFlatCase();
      case "toNthSegment":
        return placeholder.toNthSegment(Number(arg));
      case "toNthSegmentPascalCase":
        return placeholder.toNthSegmentPascalCase(Number(arg));
      case "toNthSegmentCamelCase":
        return placeholder.toNthSegmentCamelCase(Number(arg));
      case "extract":
        return placeholder.extract(arg);
      default:
        return original;
    }
  });
}
