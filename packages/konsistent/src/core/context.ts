import type { PlaceholderValue } from "./placeholder.js";

export interface PredicateContext {
  fileExists(relativePath: string): boolean;
  path: string;
  placeholders: Record<string, PlaceholderValue>;
  readDir(relativePath: string): string[];
  resolveTemplate(template: string): string;
}
