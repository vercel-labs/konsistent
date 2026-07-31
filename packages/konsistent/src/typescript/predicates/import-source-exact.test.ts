import { describe, expect, it } from "vitest";
import type { PredicateContext } from "../../core/context.js";
import { parseFileStructure } from "../parser.js";
import { checkExactImportSource } from "./import-source-exact.js";

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

describe("checkExactImportSource", () => {
  it("matches exact relative import sources", () => {
    const result = checkExactImportSource({
      expected: "./helper",
      context: createMockContext({ path: "src/index.ts" }),
      fileStructure: parseSource({ source: "import './helper';" }),
    });
    expect(result).toEqual([]);
  });

  it("returns a diagnostic when the import source is missing", () => {
    const result = checkExactImportSource({
      expected: "./helper",
      context: createMockContext({ path: "src/index.ts" }),
      fileStructure: parseSource({ source: "import './setup';" }),
    });
    expect(result).toHaveLength(1);
    expect(result[0].message).toBe('Missing import from "./helper"');
    expect(result[0].predicateName).toBe("importValuesFrom");
    expect(result[0].filePath).toBe("src/index.ts");
  });

  it("matches exact package import sources", () => {
    const result = checkExactImportSource({
      expected: "react",
      context: createMockContext({ path: "src/index.ts" }),
      fileStructure: parseSource({
        source: "import React from 'react';",
      }),
    });
    expect(result).toEqual([]);
  });

  it("does not match package subpaths without a wildcard", () => {
    const result = checkExactImportSource({
      expected: "package",
      context: createMockContext({ path: "src/index.ts" }),
      fileStructure: parseSource({
        source: "import { value } from 'package/v4';",
      }),
    });
    expect(result).toHaveLength(1);
    expect(result[0].message).toBe('Missing import from "package"');
  });

  it("matches package subpaths with a trailing wildcard", () => {
    const result = checkExactImportSource({
      expected: "package/*",
      context: createMockContext({ path: "src/index.ts" }),
      fileStructure: parseSource({
        source: "import { value } from 'package/v4';",
      }),
    });
    expect(result).toEqual([]);
  });

  it("matches scoped package subpaths with a trailing wildcard", () => {
    const result = checkExactImportSource({
      expected: "@scope/pkg/*",
      context: createMockContext({ path: "src/index.ts" }),
      fileStructure: parseSource({
        source: "import { tool } from '@scope/pkg/tools';",
      }),
    });
    expect(result).toEqual([]);
  });

  it("does not match package roots with a trailing wildcard", () => {
    const result = checkExactImportSource({
      expected: "package/*",
      context: createMockContext({ path: "src/index.ts" }),
      fileStructure: parseSource({
        source: "import { value } from 'package';",
      }),
    });
    expect(result).toHaveLength(1);
    expect(result[0].message).toBe('Missing import from "package/*"');
  });

  it("does not match similarly named packages with a trailing wildcard", () => {
    const result = checkExactImportSource({
      expected: "react/*",
      context: createMockContext({ path: "src/index.ts" }),
      fileStructure: parseSource({
        source: "import { render } from 'react-dom/client';",
      }),
    });
    expect(result).toHaveLength(1);
  });

  it("matches type-only import statements", () => {
    const result = checkExactImportSource({
      expected: "@scope/pkg",
      importKind: "type",
      predicateName: "importTypesFrom",
      context: createMockContext({ path: "src/index.ts" }),
      fileStructure: parseSource({
        source: "import type { Tool } from '@scope/pkg';",
      }),
    });
    expect(result).toEqual([]);
  });

  it("importValuesFrom ignores type-only imports", () => {
    const result = checkExactImportSource({
      expected: "@scope/pkg",
      importKind: "value",
      predicateName: "importValuesFrom",
      context: createMockContext({ path: "src/index.ts" }),
      fileStructure: parseSource({
        source: "import type { Tool } from '@scope/pkg';",
      }),
    });
    expect(result).toHaveLength(1);
    expect(result[0].predicateName).toBe("importValuesFrom");
    expect(result[0].message).toBe('Missing import from "@scope/pkg"');
  });

  it("importTypesFrom ignores value imports", () => {
    const result = checkExactImportSource({
      expected: "@scope/pkg",
      importKind: "type",
      predicateName: "importTypesFrom",
      context: createMockContext({ path: "src/index.ts" }),
      fileStructure: parseSource({
        source: "import { tool } from '@scope/pkg';",
      }),
    });
    expect(result).toHaveLength(1);
    expect(result[0].predicateName).toBe("importTypesFrom");
    expect(result[0].message).toBe('Missing type import from "@scope/pkg"');
  });

  it("mixed imports satisfy both value and type source predicates", () => {
    const fileStructure = parseSource({
      source: "import { type Tool, tool } from '@scope/pkg';",
    });
    const context = createMockContext({ path: "src/index.ts" });

    expect(
      checkExactImportSource({
        expected: "@scope/pkg",
        importKind: "value",
        predicateName: "importValuesFrom",
        context,
        fileStructure,
      })
    ).toEqual([]);
    expect(
      checkExactImportSource({
        expected: "@scope/pkg",
        importKind: "type",
        predicateName: "importTypesFrom",
        context,
        fileStructure,
      })
    ).toEqual([]);
  });

  it("side-effect imports satisfy importValuesFrom only", () => {
    const fileStructure = parseSource({ source: "import './setup';" });
    const context = createMockContext({ path: "src/index.ts" });

    expect(
      checkExactImportSource({
        expected: "./setup",
        importKind: "value",
        predicateName: "importValuesFrom",
        context,
        fileStructure,
      })
    ).toEqual([]);
    expect(
      checkExactImportSource({
        expected: "./setup",
        importKind: "type",
        predicateName: "importTypesFrom",
        context,
        fileStructure,
      })
    ).toHaveLength(1);
  });

  it("resolves template placeholders in the source", () => {
    const result = checkExactImportSource({
      expected: "@scope/${packageName}/*",
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

  it("requires every import source in an array", () => {
    const result = checkExactImportSource({
      expected: ["react", "package/*"],
      context: createMockContext({ path: "src/index.ts" }),
      fileStructure: parseSource({
        source: [
          "import React from 'react';",
          "import { value } from 'package/v4';",
        ].join("\n"),
      }),
    });
    expect(result).toEqual([]);
  });

  it("returns diagnostics for missing import sources in an array", () => {
    const result = checkExactImportSource({
      expected: ["react", "package"],
      context: createMockContext({ path: "src/index.ts" }),
      fileStructure: parseSource({
        source: "import { value } from 'package/v4';",
      }),
    });
    expect(result).toHaveLength(2);
    expect(result.map((d) => d.message)).toEqual([
      'Missing import from "react"',
      'Missing import from "package"',
    ]);
  });

  it("includes conventionName when provided", () => {
    const result = checkExactImportSource({
      expected: "react",
      context: createMockContext({ path: "src/index.ts" }),
      fileStructure: parseSource({ source: "" }),
      conventionName: "react-files",
    });
    expect(result[0].conventionName).toBe("react-files");
  });
});
