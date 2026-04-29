const CAMEL_BOUNDARY = /([a-z])([A-Z])/g;
const SEPARATORS = /[-_]/;

export function splitWords(value: string): string[] {
  return value
    .replace(CAMEL_BOUNDARY, "$1-$2")
    .split(SEPARATORS)
    .filter((w) => w.length > 0);
}

export function toPascalCase(value: string): string {
  return splitWords(value)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join("");
}

export function toCamelCase(value: string): string {
  const words = splitWords(value);
  if (words.length === 0) {
    return "";
  }
  return [
    words[0].toLowerCase(),
    ...words
      .slice(1)
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()),
  ].join("");
}

export function toKebabCase(value: string): string {
  return splitWords(value)
    .map((w) => w.toLowerCase())
    .join("-");
}

export function toSnakeCase(value: string): string {
  return splitWords(value)
    .map((w) => w.toLowerCase())
    .join("_");
}
