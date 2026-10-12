import { describe, expect, it } from "vitest";
import type { PredicateContext } from "../core/context.js";
import { PlaceholderValue } from "../core/placeholder.js";
import { resolveTemplate } from "../core/template.js";
import { checkHaveFiles } from "./have-files.js";

function createMockContext(opts: {
  path: string;
  existingFiles?: Set<string>;
  placeholders?: Record<string, PlaceholderValue>;
}): PredicateContext {
  const existingFiles = opts.existingFiles ?? new Set<string>();
  const placeholders = opts.placeholders ?? {};
  return {
    directoryExists: () => false,
    fileExists: (rel: string) => existingFiles.has(rel),
    path: opts.path,
    placeholders,
    readDir: () => [],
    resolveTemplate: (template: string) =>
      resolveTemplate({ placeholders, template }),
  };
}

describe("checkHaveFiles", () => {
  it("returns no diagnostics when all files exist", () => {
    const result = checkHaveFiles({
      context: createMockContext({
        existingFiles: new Set(["index.ts", "manifest.json"]),
        path: "plugins/auth",
      }),
      expected: ["index.ts", "manifest.json"],
    });
    expect(result).toEqual([]);
  });

  it("returns diagnostic for each missing file", () => {
    const result = checkHaveFiles({
      context: createMockContext({
        existingFiles: new Set(["index.ts"]),
        path: "plugins/auth",
      }),
      expected: ["index.ts", "manifest.json", "README.md"],
    });
    expect(result).toHaveLength(2);
    expect(result[0].message).toBe("Missing required file: manifest.json");
    expect(result[1].message).toBe("Missing required file: README.md");
  });

  it("requires one match for each pattern independently", () => {
    const result = checkHaveFiles({
      context: createMockContext({
        existingFiles: new Set(["instructions/*.{md,ts}", "README.md"]),
        path: "packages/openai",
      }),
      expected: ["instructions/*.{md,ts}", "src/**/*.ts", "README.md"],
    });
    expect(result).toHaveLength(1);
    expect(result[0].message).toBe("Missing required file: src/**/*.ts");
  });

  it("resolves templates in file names", () => {
    const placeholders = {
      name: new PlaceholderValue({ value: "openai" }),
    };
    const result = checkHaveFiles({
      context: createMockContext({
        existingFiles: new Set(["OpenaiProvider.ts"]),
        path: "packages/openai",
        placeholders,
      }),
      expected: ["${name.toPascalCase()}Provider.ts"],
    });
    expect(result).toEqual([]);
  });

  it("resolves placeholders before matching a file pattern", () => {
    const placeholders = {
      name: new PlaceholderValue({ value: "openai" }),
    };
    const result = checkHaveFiles({
      context: createMockContext({
        existingFiles: new Set(["instructions/openai*.{md,ts}"]),
        path: "packages/openai",
        placeholders,
      }),
      expected: ["instructions/${name}*.{md,ts}"],
    });
    expect(result).toEqual([]);
  });

  it("reports missing template-resolved file", () => {
    const placeholders = {
      name: new PlaceholderValue({ value: "openai" }),
    };
    const result = checkHaveFiles({
      context: createMockContext({
        existingFiles: new Set(),
        path: "packages/openai",
        placeholders,
      }),
      expected: ["${name.toPascalCase()}Provider.ts"],
    });
    expect(result).toHaveLength(1);
    expect(result[0].message).toBe("Missing required file: OpenaiProvider.ts");
  });

  it("includes conventionName when provided", () => {
    const result = checkHaveFiles({
      context: createMockContext({ path: "src" }),
      conventionName: "test-rule",
      expected: ["missing.ts"],
    });
    expect(result[0].conventionName).toBe("test-rule");
  });

  it("sets predicateName to haveFiles", () => {
    const result = checkHaveFiles({
      context: createMockContext({ path: "src" }),
      expected: ["missing.ts"],
    });
    expect(result[0].predicateName).toBe("haveFiles");
  });
});
