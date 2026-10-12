import { describe, expect, it } from "vitest";
import type { PredicateContext } from "../../core/context.js";
import { parseFileStructure } from "../parser.js";
import { checkImportSourceExact } from "./import-source-exact.js";

function createMockContext(opts: {
  path: string;
  placeholders?: Record<string, { toString: () => string }>;
}): PredicateContext {
  const placeholders = opts.placeholders ?? {};
  return {
    directoryExists: () => false,
    fileExists: () => false,
    path: opts.path,
    placeholders: placeholders as PredicateContext["placeholders"],
    readDir: () => [],
    resolveTemplate(t: string): string {
      return t.replace(/\$\{(\w+)\}/g, (_match, name) => {
        const ph = placeholders[name];
        return ph ? ph.toString() : _match;
      });
    },
  };
}

function parseSource(opts: { source: string }) {
  return parseFileStructure({ filePath: "src/index.ts", source: opts.source });
}

describe("checkImportSourceExact", () => {
  it("matches exact relative import sources", () => {
    const result = checkImportSourceExact({
      context: createMockContext({ path: "src/index.ts" }),
      expected: "./helper",
      fileStructure: parseSource({ source: "import './helper';" }),
    });
    expect(result).toEqual([]);
  });

  it("returns a diagnostic when the import source is missing", () => {
    const result = checkImportSourceExact({
      context: createMockContext({ path: "src/index.ts" }),
      expected: "./helper",
      fileStructure: parseSource({ source: "import './setup';" }),
    });
    expect(result).toHaveLength(1);
    expect(result[0].message).toBe('Missing import from "./helper"');
    expect(result[0].predicateName).toBe("importValuesFrom");
    expect(result[0].filePath).toBe("src/index.ts");
  });

  it("matches exact package import sources", () => {
    const result = checkImportSourceExact({
      context: createMockContext({ path: "src/index.ts" }),
      expected: "react",
      fileStructure: parseSource({
        source: "import React from 'react';",
      }),
    });
    expect(result).toEqual([]);
  });

  it("does not match package subpaths without a wildcard", () => {
    const result = checkImportSourceExact({
      context: createMockContext({ path: "src/index.ts" }),
      expected: "package",
      fileStructure: parseSource({
        source: "import { value } from 'package/v4';",
      }),
    });
    expect(result).toHaveLength(1);
    expect(result[0].message).toBe('Missing import from "package"');
  });

  it("matches package subpaths with a trailing wildcard", () => {
    const result = checkImportSourceExact({
      context: createMockContext({ path: "src/index.ts" }),
      expected: "package/*",
      fileStructure: parseSource({
        source: "import { value } from 'package/v4';",
      }),
    });
    expect(result).toEqual([]);
  });

  it("matches scoped package subpaths with a trailing wildcard", () => {
    const result = checkImportSourceExact({
      context: createMockContext({ path: "src/index.ts" }),
      expected: "@scope/pkg/*",
      fileStructure: parseSource({
        source: "import { tool } from '@scope/pkg/tools';",
      }),
    });
    expect(result).toEqual([]);
  });

  it("matches package roots and sub-entrypoints from a vendor", () => {
    for (const source of ["@vendor/project", "@vendor/project/tools"]) {
      const result = checkImportSourceExact({
        context: createMockContext({ path: "src/index.ts" }),
        expected: "@vendor/*",
        fileStructure: parseSource({
          source: `import { value } from '${source}';`,
        }),
      });
      expect(result).toEqual([]);
    }
  });

  it("does not match package roots with a trailing wildcard", () => {
    const result = checkImportSourceExact({
      context: createMockContext({ path: "src/index.ts" }),
      expected: "package/*",
      fileStructure: parseSource({
        source: "import { value } from 'package';",
      }),
    });
    expect(result).toHaveLength(1);
    expect(result[0].message).toBe('Missing import from "package/*"');
  });

  it("does not match similarly named packages with a trailing wildcard", () => {
    const result = checkImportSourceExact({
      context: createMockContext({ path: "src/index.ts" }),
      expected: "react/*",
      fileStructure: parseSource({
        source: "import { render } from 'react-dom/client';",
      }),
    });
    expect(result).toHaveLength(1);
  });

  it("matches type-only import statements", () => {
    const result = checkImportSourceExact({
      context: createMockContext({ path: "src/index.ts" }),
      expected: "@scope/pkg",
      fileStructure: parseSource({
        source: "import type { Tool } from '@scope/pkg';",
      }),
      importKind: "type",
      predicateName: "importTypesFrom",
    });
    expect(result).toEqual([]);
  });

  it("importValuesFrom ignores type-only imports", () => {
    const result = checkImportSourceExact({
      context: createMockContext({ path: "src/index.ts" }),
      expected: "@scope/pkg",
      fileStructure: parseSource({
        source: "import type { Tool } from '@scope/pkg';",
      }),
      importKind: "value",
      predicateName: "importValuesFrom",
    });
    expect(result).toHaveLength(1);
    expect(result[0].predicateName).toBe("importValuesFrom");
    expect(result[0].message).toBe('Missing import from "@scope/pkg"');
  });

  it("importTypesFrom ignores value imports", () => {
    const result = checkImportSourceExact({
      context: createMockContext({ path: "src/index.ts" }),
      expected: "@scope/pkg",
      fileStructure: parseSource({
        source: "import { tool } from '@scope/pkg';",
      }),
      importKind: "type",
      predicateName: "importTypesFrom",
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
      checkImportSourceExact({
        context,
        expected: "@scope/pkg",
        fileStructure,
        importKind: "value",
        predicateName: "importValuesFrom",
      })
    ).toEqual([]);
    expect(
      checkImportSourceExact({
        context,
        expected: "@scope/pkg",
        fileStructure,
        importKind: "type",
        predicateName: "importTypesFrom",
      })
    ).toEqual([]);
  });

  it("side-effect imports satisfy importValuesFrom only", () => {
    const fileStructure = parseSource({ source: "import './setup';" });
    const context = createMockContext({ path: "src/index.ts" });

    expect(
      checkImportSourceExact({
        context,
        expected: "./setup",
        fileStructure,
        importKind: "value",
        predicateName: "importValuesFrom",
      })
    ).toEqual([]);
    expect(
      checkImportSourceExact({
        context,
        expected: "./setup",
        fileStructure,
        importKind: "type",
        predicateName: "importTypesFrom",
      })
    ).toHaveLength(1);
  });

  it("resolves template placeholders in the source", () => {
    const result = checkImportSourceExact({
      context: createMockContext({
        path: "src/index.ts",
        placeholders: { packageName: { toString: () => "pkg" } },
      }),
      expected: "@scope/${packageName}/*",
      fileStructure: parseSource({
        source: "import { tool } from '@scope/pkg/tools';",
      }),
    });
    expect(result).toEqual([]);
  });

  it("resolves template placeholders in selector exclusions", () => {
    const result = checkImportSourceExact({
      context: createMockContext({
        path: "src/index.ts",
        placeholders: { vendor: { toString: () => "ai-sdk" } },
      }),
      expected: [
        "@${vendor}/*",
        "!@${vendor}/harness/*",
        "@${vendor}/harness/bridge",
      ],
      fileStructure: parseSource({
        source: "import { bridge } from '@ai-sdk/harness/bridge';",
      }),
    });
    expect(result).toEqual([]);
  });

  it("accepts selected imports and rejects excluded imports", () => {
    const expected = [
      "@ai-sdk/*",
      "!@ai-sdk/harness",
      "!@ai-sdk/harness/*",
      "@ai-sdk/harness/bridge",
    ];
    const context = createMockContext({ path: "src/index.ts" });

    expect(
      checkImportSourceExact({
        context,
        expected,
        fileStructure: parseSource({
          source: "import { generate } from '@ai-sdk/core';",
        }),
      })
    ).toEqual([]);
    expect(
      checkImportSourceExact({
        context,
        expected,
        fileStructure: parseSource({
          source: "import { harness } from '@ai-sdk/harness';",
        }),
      }).map((diagnostic) => diagnostic.message)
    ).toEqual(['Missing import from "@ai-sdk/*"']);
    expect(
      checkImportSourceExact({
        context,
        expected,
        fileStructure: parseSource({
          source: "import { bridge } from '@ai-sdk/harness/bridge';",
        }),
      })
    ).toEqual([]);
  });

  it("applies selectors only to imports of the requested kind", () => {
    const expected = ["@vendor/*", "!@vendor/excluded"];
    const context = createMockContext({ path: "src/index.ts" });

    expect(
      checkImportSourceExact({
        context,
        expected,
        fileStructure: parseSource({
          source: "import type { Tool } from '@vendor/project';",
        }),
        importKind: "type",
        predicateName: "importTypesFrom",
      })
    ).toEqual([]);
    expect(
      checkImportSourceExact({
        context,
        expected,
        fileStructure: parseSource({
          source: "import { tool } from '@vendor/project';",
        }),
        importKind: "type",
        predicateName: "importTypesFrom",
      }).map((diagnostic) => diagnostic.message)
    ).toEqual(['Missing type import from "@vendor/*"']);
  });

  it("requires every import source in an array", () => {
    const result = checkImportSourceExact({
      context: createMockContext({ path: "src/index.ts" }),
      expected: ["react", "package/*"],
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
    const result = checkImportSourceExact({
      context: createMockContext({ path: "src/index.ts" }),
      expected: ["react", "package"],
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

  it("keeps exact entries and a wildcard selector as MUST-ALL constraints", () => {
    const result = checkImportSourceExact({
      context: createMockContext({ path: "src/index.ts" }),
      expected: ["react", "zod", "@ai-sdk/*", "!@ai-sdk/harness"],
      fileStructure: parseSource({
        source: [
          "import React from 'react';",
          "import { harness } from '@ai-sdk/harness';",
        ].join("\n"),
      }),
    });

    expect(result.map((diagnostic) => diagnostic.message)).toEqual([
      'Missing import from "zod"',
      'Missing import from "@ai-sdk/*"',
    ]);
  });

  it("includes conventionName when provided", () => {
    const result = checkImportSourceExact({
      context: createMockContext({ path: "src/index.ts" }),
      conventionName: "react-files",
      expected: "react",
      fileStructure: parseSource({ source: "" }),
    });
    expect(result[0].conventionName).toBe("react-files");
  });
});
