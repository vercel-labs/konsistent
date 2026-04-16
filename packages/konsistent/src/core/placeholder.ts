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
  private readonly kebabToPascalMap?: Record<string, string>;
  private readonly kebabToCamelMap?: Record<string, string>;

  constructor(opts: {
    value: string;
    kebabToPascalMap?: Record<string, string>;
    kebabToCamelMap?: Record<string, string>;
  }) {
    this.raw = opts.value;
    this.kebabToPascalMap = opts.kebabToPascalMap;
    this.kebabToCamelMap = opts.kebabToCamelMap;
  }

  toString(): string {
    return this.raw;
  }

  toPascalCase(): string {
    const mapped = this.kebabToPascalMap?.[this.raw];
    if (mapped) {
      return mapped;
    }
    return splitWords(this.raw)
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
      .join('');
  }

  toCamelCase(): string {
    const mapped = this.kebabToCamelMap?.[this.raw];
    if (mapped) {
      return mapped;
    }
    const pascalMapped = this.kebabToPascalMap?.[this.raw];
    if (pascalMapped) {
      return pascalMapped.charAt(0).toLowerCase() + pascalMapped.slice(1);
    }
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
