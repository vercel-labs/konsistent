import { describe, expect, it } from "vitest";
import type { PredicateContext } from "../../core/context.js";
import { parseFileStructure } from "../parser.js";
import { checkUseDeclarationOrder } from "./use-declaration-order.js";

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

describe("checkUseDeclarationOrder", () => {
  it("passes when present declaration symbols follow the configured order", () => {
    const result = checkUseDeclarationOrder({
      expected: ["alpha", "beta", "gamma"],
      context: createMockContext({ path: "src/index.ts" }),
      fileStructure: parseSource({
        source: "const alpha = 1;\nconst gamma = 3;",
      }),
    });
    expect(result).toEqual([]);
  });

  it("does not require missing symbols", () => {
    const result = checkUseDeclarationOrder({
      expected: ["alpha", "beta", "gamma"],
      context: createMockContext({ path: "src/index.ts" }),
      fileStructure: parseSource({
        source: "const beta = 2;",
      }),
    });
    expect(result).toEqual([]);
  });

  it("reports declarations that appear after a later configured symbol", () => {
    const result = checkUseDeclarationOrder({
      expected: ["alpha", "beta", "gamma"],
      context: createMockContext({ path: "src/index.ts" }),
      fileStructure: parseSource({
        source: "const beta = 2;\nconst alpha = 1;",
      }),
    });
    expect(result).toHaveLength(1);
    expect(result[0].message).toBe(
      'Symbol "alpha" must be declared before "beta"'
    );
    expect(result[0].predicateName).toBe("useDeclarationOrder");
    expect(result[0].line).toBe(2);
  });

  it("considers named re-exports when no local declaration exists", () => {
    const result = checkUseDeclarationOrder({
      expected: ["Alpha", "Beta", "Gamma"],
      context: createMockContext({ path: "src/index.ts" }),
      fileStructure: parseSource({
        source:
          "export { Beta } from './beta';\nexport { default as Alpha } from './alpha';",
      }),
    });
    expect(result).toHaveLength(1);
    expect(result[0].message).toBe(
      'Symbol "Alpha" must be declared before "Beta"'
    );
  });

  it("uses local declaration position before matching named export position", () => {
    const result = checkUseDeclarationOrder({
      expected: ["alpha", "beta"],
      context: createMockContext({ path: "src/index.ts" }),
      fileStructure: parseSource({
        source:
          "const alpha = 1;\nexport { beta } from './beta';\nexport { alpha };",
      }),
    });
    expect(result).toEqual([]);
  });

  it("ignores default export assignments", () => {
    const result = checkUseDeclarationOrder({
      expected: ["alpha", "beta"],
      context: createMockContext({ path: "src/index.ts" }),
      fileStructure: parseSource({
        source: "const beta = 2;\nexport default alpha;",
      }),
    });
    expect(result).toEqual([]);
  });

  it("resolves templates in configured symbols", () => {
    const result = checkUseDeclarationOrder({
      expected: ["${prefix}Alpha", "${prefix}Beta"],
      context: createMockContext({
        path: "src/index.ts",
        placeholders: { prefix: { toString: () => "Thing" } },
      }),
      fileStructure: parseSource({
        source: "const ThingAlpha = 1;\nconst ThingBeta = 2;",
      }),
    });
    expect(result).toEqual([]);
  });
});
