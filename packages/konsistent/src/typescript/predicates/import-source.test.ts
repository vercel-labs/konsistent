import { describe, expect, it } from "vitest";
import type { PredicateContext } from "../../core/context.js";
import { parseFileStructure } from "../parser.js";
import { checkImportSource } from "./import-source.js";

function createMockContext(opts: { path: string }): PredicateContext {
  return {
    path: opts.path,
    placeholders: {} as PredicateContext["placeholders"],
    resolveTemplate: (t: string) => t,
    fileExists: () => false,
    readDir: () => [],
  };
}

function parseSource(opts: { source: string }) {
  return parseFileStructure({ source: opts.source, filePath: "src/index.ts" });
}

describe("checkImportSource", () => {
  it("requires imports from the current directory", () => {
    const result = checkImportSource({
      expected: true,
      predicateName: "importFromCurrentDir",
      group: "currentDir",
      context: createMockContext({ path: "src/index.ts" }),
      fileStructure: parseSource({
        source: "import { helper } from './helper';",
      }),
    });
    expect(result).toEqual([]);
  });

  it("rejects forbidden imports from the current directory", () => {
    const result = checkImportSource({
      expected: false,
      predicateName: "importFromCurrentDir",
      group: "currentDir",
      context: createMockContext({ path: "src/index.ts" }),
      fileStructure: parseSource({ source: "import './setup';" }),
    });
    expect(result).toHaveLength(1);
    expect(result[0].message).toBe(
      "Import from current directory is not allowed"
    );
    expect(result[0].line).toBe(1);
  });

  it("matches imports from parents", () => {
    const result = checkImportSource({
      expected: true,
      predicateName: "importFromParents",
      group: "parents",
      context: createMockContext({ path: "src/index.ts" }),
      fileStructure: parseSource({
        source: "import type { Parent } from '../parent';",
      }),
    });
    expect(result).toEqual([]);
  });

  it("reports missing parent imports", () => {
    const result = checkImportSource({
      expected: true,
      predicateName: "importFromParents",
      group: "parents",
      context: createMockContext({ path: "src/index.ts" }),
      fileStructure: parseSource({
        source: "import { helper } from './helper';",
      }),
    });
    expect(result).toHaveLength(1);
    expect(result[0].message).toBe("Missing import from parent directories");
  });

  it("matches external imports", () => {
    const fileStructure = parseSource({
      source: [
        "import react from 'react';",
        "import { readFile } from 'node:fs/promises';",
        "import { helper } from '@/helper';",
        "import { scoped } from '@scope/pkg';",
      ].join("\n"),
    });
    const result = checkImportSource({
      expected: true,
      predicateName: "importFromExternals",
      group: "externals",
      context: createMockContext({ path: "src/index.ts" }),
      fileStructure,
    });
    expect(result).toEqual([]);
  });

  it("rejects forbidden external imports", () => {
    const result = checkImportSource({
      expected: false,
      predicateName: "importFromExternals",
      group: "externals",
      context: createMockContext({ path: "src/index.ts" }),
      fileStructure: parseSource({ source: "import react from 'react';" }),
    });
    expect(result).toHaveLength(1);
    expect(result[0].message).toBe(
      "Import from external packages is not allowed"
    );
  });
});
