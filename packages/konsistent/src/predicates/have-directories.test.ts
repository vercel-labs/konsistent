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
    directoryExists: (path: string) => opts.directories?.has(path) ?? false,
    fileExists: () => false,
    path: "modules/openai",
    placeholders,
    readDir: () => [],
    resolveTemplate: (template: string) =>
      resolveTemplate({ placeholders, template }),
  };
}

describe("checkHaveDirectories", () => {
  it("requires each pattern independently and reports missing directories", () => {
    const diagnostics = checkHaveDirectories({
      context: createMockContext({
        directories: new Set(["instructions/*", "src"]),
      }),
      conventionName: "structure",
      expected: ["instructions/*", "metadata/*", "src"],
    });
    expect(diagnostics).toHaveLength(1);
    expect(diagnostics[0]).toMatchObject({
      conventionName: "structure",
      message: "Missing required directory: metadata/*",
      predicateName: "haveDirectories",
    });
  });

  it("resolves placeholders before matching directory patterns", () => {
    const diagnostics = checkHaveDirectories({
      context: createMockContext({
        directories: new Set(["openai*/src"]),
        placeholders: { name: new PlaceholderValue({ value: "openai" }) },
      }),
      expected: ["${name}*/src"],
    });
    expect(diagnostics).toEqual([]);
  });
});
