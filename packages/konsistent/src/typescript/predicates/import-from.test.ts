import { describe, expect, it } from "vitest";
import type { PredicateContext } from "../../core/context.js";
import { parseFileStructure } from "../parser.js";
import { checkImportFrom } from "./import-from.js";

function createMockContext(opts: {
  path: string;
  placeholders?: Record<string, { toString(): string }>;
}): PredicateContext {
  const placeholders = opts.placeholders ?? {};
  return {
    path: opts.path,
    placeholders: placeholders as PredicateContext["placeholders"],
    resolveTemplate(t: string): string {
      return t.replace(/\$\{(\w+)\}/g, (_match, name) => {
        const ph = placeholders[name];
        return ph ? ph.toString() : _match;
      });
    },
    fileExists: () => false,
    readDir: () => [],
  };
}

function parseSource(opts: { source: string }) {
  return parseFileStructure({ source: opts.source, filePath: "src/index.ts" });
}

describe("checkImportFrom", () => {
  it("matches exact relative import sources", () => {
    const result = checkImportFrom({
      expected: "./helper",
      context: createMockContext({ path: "src/index.ts" }),
      fileStructure: parseSource({ source: "import './helper';" }),
    });
    expect(result).toEqual([]);
  });

  it("returns a diagnostic when the import source is missing", () => {
    const result = checkImportFrom({
      expected: "./helper",
      context: createMockContext({ path: "src/index.ts" }),
      fileStructure: parseSource({ source: "import './setup';" }),
    });
    expect(result).toHaveLength(1);
    expect(result[0].message).toBe('Missing import from "./helper"');
    expect(result[0].predicateName).toBe("importFrom");
    expect(result[0].filePath).toBe("src/index.ts");
  });

  it("matches package subpaths from an unscoped package root", () => {
    const result = checkImportFrom({
      expected: "react",
      context: createMockContext({ path: "src/index.ts" }),
      fileStructure: parseSource({
        source: "import { jsx } from 'react/jsx-runtime';",
      }),
    });
    expect(result).toEqual([]);
  });

  it("matches package subpaths from a scoped package root", () => {
    const result = checkImportFrom({
      expected: "@scope/pkg",
      context: createMockContext({ path: "src/index.ts" }),
      fileStructure: parseSource({
        source: "import { tool } from '@scope/pkg/tools';",
      }),
    });
    expect(result).toEqual([]);
  });

  it("does not match similarly named packages", () => {
    const result = checkImportFrom({
      expected: "react",
      context: createMockContext({ path: "src/index.ts" }),
      fileStructure: parseSource({
        source: "import { render } from 'react-dom';",
      }),
    });
    expect(result).toHaveLength(1);
  });

  it("treats package subpaths as exact sources", () => {
    const result = checkImportFrom({
      expected: "@scope/pkg/tools",
      context: createMockContext({ path: "src/index.ts" }),
      fileStructure: parseSource({
        source: "import { helper } from '@scope/pkg/tools/helper';",
      }),
    });
    expect(result).toHaveLength(1);
    expect(result[0].message).toBe('Missing import from "@scope/pkg/tools"');
  });

  it("matches type-only import statements", () => {
    const result = checkImportFrom({
      expected: "@scope/pkg",
      context: createMockContext({ path: "src/index.ts" }),
      fileStructure: parseSource({
        source: "import type { Tool } from '@scope/pkg';",
      }),
    });
    expect(result).toEqual([]);
  });

  it("resolves template placeholders in the source", () => {
    const result = checkImportFrom({
      expected: "@scope/${packageName}",
      context: createMockContext({
        path: "src/index.ts",
        placeholders: { packageName: { toString: () => "pkg" } },
      }),
      fileStructure: parseSource({
        source: "import { tool } from '@scope/pkg/tools';",
      }),
    });
    expect(result).toEqual([]);
  });

  it("includes conventionName when provided", () => {
    const result = checkImportFrom({
      expected: "react",
      context: createMockContext({ path: "src/index.ts" }),
      fileStructure: parseSource({ source: "" }),
      conventionName: "react-files",
    });
    expect(result[0].conventionName).toBe("react-files");
  });
});
