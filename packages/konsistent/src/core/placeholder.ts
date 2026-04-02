const CAMEL_BOUNDARY = /([a-z])([A-Z])/g;
const SEPARATORS = /[-_]/;

function splitWords(value: string): string[] {
  return value
    .replace(CAMEL_BOUNDARY, '$1-$2')
    .split(SEPARATORS)
    .filter((w) => w.length > 0);
}

export class PlaceholderValue {
  readonly raw: string;

  constructor(opts: { value: string }) {
    this.raw = opts.value;
  }

  toString(): string {
    return this.raw;
  }

  toPascalCase(): string {
    return splitWords(this.raw)
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
      .join('');
  }

  toCamelCase(): string {
    const words = splitWords(this.raw);
    if (words.length === 0) {
      return '';
    }
    return [
      words[0].toLowerCase(),
      ...words
        .slice(1)
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()),
    ].join('');
  }

  toKebabCase(): string {
    return splitWords(this.raw)
      .map((w) => w.toLowerCase())
      .join('-');
  }

  toSnakeCase(): string {
    return splitWords(this.raw)
      .map((w) => w.toLowerCase())
      .join('_');
  }
}
