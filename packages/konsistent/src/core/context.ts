import type { PlaceholderValue } from './placeholder.js';

export interface PredicateContext {
  path: string;
  placeholders: Record<string, PlaceholderValue>;
  resolveTemplate(template: string): string;
  fileExists(relativePath: string): boolean;
  readDir(relativePath: string): string[];
}
