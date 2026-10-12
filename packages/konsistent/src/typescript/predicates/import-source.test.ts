import { describe, expect, it } from "vitest";
import type { PredicateContext } from "../../core/context.js";
import { parseFileStructure } from "../parser.js";
import { checkImportSource } from "./import-source.js";

function createMockContext(opts: { path: string }): PredicateContext {
  return {
    directoryExists: () => false,
    fileExists: () => false,
    path: opts.path,
    placeholders: {} as PredicateContext["placeholders"],
    readDir: () => [],
    resolveTemplate: (t: string) => t,
  };
}

function parseSource(opts: { source: string }) {
  return parseFileStructure({ filePath: "src/index.ts", source: opts.source });
}

describe("checkImportSource", () => {
  it("requires imports from the current directory", () => {
    const result = checkImportSource({
      context: createMockContext({ path: "src/index.ts" }),
      expected: true,
      fileStructure: parseSource({
        source: "import { helper } from './helper';",
      }),
      group: "currentDir",
      importKind: "value",
      predicateName: "importValuesFromCurrentDir",
    });
    expect(result).toEqual([]);
  });

  it("rejects forbidden imports from the current directory", () => {
    const result = checkImportSource({
      context: createMockContext({ path: "src/index.ts" }),
      expected: false,
      fileStructure: parseSource({ source: "import './setup';" }),
      group: "currentDir",
      importKind: "value",
      predicateName: "importValuesFromCurrentDir",
    });
    expect(result).toHaveLength(1);
    expect(result[0].message).toBe(
      "Import from current directory is not allowed"
    );
    expect(result[0].line).toBe(1);
  });

  it("matches imports from parents", () => {
    const result = checkImportSource({
      context: createMockContext({ path: "src/index.ts" }),
      expected: true,
      fileStructure: parseSource({
        source: "import { parent } from '../parent';",
      }),
      group: "parents",
      importKind: "value",
      predicateName: "importValuesFromParents",
    });
    expect(result).toEqual([]);
  });

  it("ignores type imports for value import source predicates", () => {
    const result = checkImportSource({
      context: createMockContext({ path: "src/index.ts" }),
      expected: true,
      fileStructure: parseSource({
        source: "import type { Parent } from '../parent';",
      }),
      group: "parents",
      importKind: "value",
      predicateName: "importValuesFromParents",
    });
    expect(result).toHaveLength(1);
    expect(result[0].message).toBe("Missing import from parent directories");
  });

  it("matches type imports from parents", () => {
    const result = checkImportSource({
      context: createMockContext({ path: "src/index.ts" }),
      expected: true,
      fileStructure: parseSource({
        source: "import type { Parent } from '../parent';",
      }),
      group: "parents",
      importKind: "type",
      predicateName: "importTypesFromParents",
    });
    expect(result).toEqual([]);
  });

  it("ignores value imports for type import source predicates", () => {
    const result = checkImportSource({
      context: createMockContext({ path: "src/index.ts" }),
      expected: true,
      fileStructure: parseSource({
        source: "import { helper } from './helper';",
      }),
      group: "currentDir",
      importKind: "type",
      predicateName: "importTypesFromCurrentDir",
    });
    expect(result).toHaveLength(1);
    expect(result[0].message).toBe(
      "Missing type import from current directory"
    );
  });

  it("rejects forbidden type imports from externals", () => {
    const result = checkImportSource({
      context: createMockContext({ path: "src/index.ts" }),
      expected: false,
      fileStructure: parseSource({
        source: "import type { ZodType } from 'zod';",
      }),
      group: "externals",
      importKind: "type",
      predicateName: "importTypesFromExternals",
    });
    expect(result).toHaveLength(1);
    expect(result[0].message).toBe(
      "Type import from external packages is not allowed"
    );
  });

  it("matches mixed imports for both value and type predicates", () => {
    const fileStructure = parseSource({
      source: "import { type HelperOptions, helper } from './helper';",
    });
    const valueResult = checkImportSource({
      context: createMockContext({ path: "src/index.ts" }),
      expected: true,
      fileStructure,
      group: "currentDir",
      importKind: "value",
      predicateName: "importValuesFromCurrentDir",
    });
    const typeResult = checkImportSource({
      context: createMockContext({ path: "src/index.ts" }),
      expected: true,
      fileStructure,
      group: "currentDir",
      importKind: "type",
      predicateName: "importTypesFromCurrentDir",
    });
    expect(valueResult).toEqual([]);
    expect(typeResult).toEqual([]);
  });

  it("reports missing parent imports", () => {
    const result = checkImportSource({
      context: createMockContext({ path: "src/index.ts" }),
      expected: true,
      fileStructure: parseSource({
        source: "import { helper } from './helper';",
      }),
      group: "parents",
      importKind: "value",
      predicateName: "importValuesFromParents",
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
      context: createMockContext({ path: "src/index.ts" }),
      expected: true,
      fileStructure,
      group: "externals",
      importKind: "value",
      predicateName: "importValuesFromExternals",
    });
    expect(result).toEqual([]);
  });

  it("rejects forbidden external imports", () => {
    const result = checkImportSource({
      context: createMockContext({ path: "src/index.ts" }),
      expected: false,
      fileStructure: parseSource({ source: "import react from 'react';" }),
      group: "externals",
      importKind: "value",
      predicateName: "importValuesFromExternals",
    });
    expect(result).toHaveLength(1);
    expect(result[0].message).toBe(
      "Import from external packages is not allowed"
    );
  });
});
