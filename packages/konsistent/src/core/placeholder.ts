import {
  toCamelCase,
  toKebabCase,
  toPascalCase,
  toSnakeCase,
} from './case-utils.js';

export class PlaceholderValue {
  readonly raw: string;
  private readonly kebabToPascalMap?: Record<string, string>;
  private readonly kebabToCamelMap?: Record<string, string>;
  private readonly pascalToKebabMap?: Record<string, string>;
  private readonly camelToKebabMap?: Record<string, string>;
  private readonly camelToPascalMap?: Record<string, string>;
  private readonly pascalToCamelMap?: Record<string, string>;

  constructor(opts: {
    value: string;
    kebabToPascalMap?: Record<string, string>;
    kebabToCamelMap?: Record<string, string>;
    pascalToKebabMap?: Record<string, string>;
    camelToKebabMap?: Record<string, string>;
    camelToPascalMap?: Record<string, string>;
    pascalToCamelMap?: Record<string, string>;
  }) {
    this.raw = opts.value;
    this.kebabToPascalMap = opts.kebabToPascalMap;
    this.kebabToCamelMap = opts.kebabToCamelMap;
    this.pascalToKebabMap = opts.pascalToKebabMap;
    this.camelToKebabMap = opts.camelToKebabMap;
    this.camelToPascalMap = opts.camelToPascalMap;
    this.pascalToCamelMap = opts.pascalToCamelMap;
  }

  toString(): string {
    return this.raw;
  }

  toPascalCase(): string {
    const mapped =
      this.kebabToPascalMap?.[this.raw] ?? this.camelToPascalMap?.[this.raw];
    if (mapped) {
      return mapped;
    }
    return toPascalCase(this.raw);
  }

  toCamelCase(): string {
    const mapped =
      this.kebabToCamelMap?.[this.raw] ?? this.pascalToCamelMap?.[this.raw];
    if (mapped) {
      return mapped;
    }
    const pascalMapped = this.kebabToPascalMap?.[this.raw];
    if (pascalMapped) {
      return pascalMapped.charAt(0).toLowerCase() + pascalMapped.slice(1);
    }
    return toCamelCase(this.raw);
  }

  toKebabCase(): string {
    const mapped =
      this.pascalToKebabMap?.[this.raw] ?? this.camelToKebabMap?.[this.raw];
    if (mapped) {
      return mapped;
    }
    return toKebabCase(this.raw);
  }

  toSnakeCase(): string {
    const mapped =
      this.pascalToKebabMap?.[this.raw] ?? this.camelToKebabMap?.[this.raw];
    if (mapped) {
      return mapped.replace(/-/g, '_');
    }
    return toSnakeCase(this.raw);
  }

  toFlatCase(): string {
    return this.raw.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
  }

  toNthSegment(n: number): string {
    const segments = this.raw.split('-');
    return n < segments.length ? segments[n] : '';
  }

  toNthSegmentPascalCase(n: number): string {
    const segment = this.toNthSegment(n);
    if (segment === '') {
      return '';
    }
    const mapped = this.kebabToPascalMap?.[segment];
    if (mapped) {
      return mapped;
    }
    // This is just one segment, so we can just uppercase the first letter and lowercase the rest.
    return segment.charAt(0).toUpperCase() + segment.slice(1).toLowerCase();
  }

  toNthSegmentCamelCase(n: number): string {
    const segment = this.toNthSegment(n);
    if (segment === '') {
      return '';
    }
    const mapped = this.kebabToCamelMap?.[segment];
    if (mapped) {
      return mapped;
    }
    const pascalMapped = this.kebabToPascalMap?.[segment];
    if (pascalMapped) {
      return pascalMapped.charAt(0).toLowerCase() + pascalMapped.slice(1);
    }
    // This is just one segment, so we can just lowercase it.
    return segment.toLowerCase();
  }

  extract(pattern: string): string {
    let regex: RegExp;
    try {
      regex = new RegExp(pattern);
    } catch {
      return '';
    }
    const match = this.raw.match(regex);
    if (!match) {
      return '';
    }
    return match.length > 1 ? (match[1] ?? '') : match[0];
  }
}
