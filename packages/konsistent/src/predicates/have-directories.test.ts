import { describe, expect, it } from "vitest";
import type { PredicateContext } from "../core/context.js";
import { PlaceholderValue } from "../core/placeholder.js";
import { resolveTemplate } from "../core/template.js";
import { checkHaveDirectories } from "./have-directories.js";

function createMockContext(opts: {
  directories?: Set<string>;
  placeholders?: Record<string, PlaceholderValue>;
}): PredicateContext {
  const placeholders = opts.placeholders ?? {};
  return {
    path: "modules/openai",
    placeholders,
    resolveTemplate: (template: string) =>
      resolveTemplate({ template, placeholders }),
    directoryExists: (path: string) => opts.directories?.has(path) ?? false,
    fileExists: () => false,
    readDir: () => [],
  };
}

describe("checkHaveDirectories", () => {
  it("requires each pattern independently and reports missing directories", () => {
    const diagnostics = checkHaveDirectories({
      expected: ["instructions/*", "metadata/*", "src"],
      context: createMockContext({
        directories: new Set(["instructions/*", "src"]),
      }),
      conventionName: "structure",
    });
    expect(diagnostics).toHaveLength(1);
    expect(diagnostics[0]).toMatchObject({
      predicateName: "haveDirectories",
      conventionName: "structure",
      message: "Missing required directory: metadata/*",
    });
  });

  it("resolves placeholders before matching directory patterns", () => {
    const diagnostics = checkHaveDirectories({
      expected: ["${name}*/src"],
      context: createMockContext({
        directories: new Set(["openai*/src"]),
        placeholders: { name: new PlaceholderValue({ value: "openai" }) },
      }),
    });
    expect(diagnostics).toEqual([]);
  });
});
