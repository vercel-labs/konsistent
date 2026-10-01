import type { PlaceholderValue } from "./placeholder.js";

export interface PredicateContext {
  directoryExists(relativePath: string): boolean;
  fileExists(relativePath: string): boolean;
  path: string;
  placeholders: Record<string, PlaceholderValue>;
  readDir(relativePath: string): string[];
  resolveTemplate(template: string): string;
}
