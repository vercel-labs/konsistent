import type { ReusableConventionV1 } from "@konsistent/convention";
import { describe, expect, it } from "vitest";
import { validatePlaceholders } from "./placeholder-validator.js";
import { expandReferences } from "./reference-expander.js";
import type { ConventionV1 } from "./schema.js";
import type { SourceMap } from "./source-resolver.js";

function buildSourceMap(
  entries: Record<string, ReusableConventionV1[]>
): SourceMap {
  const map: SourceMap = new Map();
  for (const [prefix, conventions] of Object.entries(entries)) {
    const inner = new Map<string, ReusableConventionV1>();
    for (const convention of conventions) {
      inner.set(convention.name, convention);
    }
    map.set(prefix, inner);
  }
  return map;
}

describe("expandReferences", () => {
  it("expands a string-ref to the matching reusable convention", () => {
    const sourceMap = buildSourceMap({
      common: [
        {
          description: "Every package must have a README.md.",
          must: { haveFiles: ["README.md"] },
          name: "package-must-have-readme",
          paths: ["packages/{packageName}"],
        },
      ],
    });

    const result = expandReferences({
      conventions: ["common/package-must-have-readme"],
      sourceMap,
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.conventions).toHaveLength(1);
      const [expanded] = result.conventions;
      expect(expanded?.name).toBe("package-must-have-readme");
      expect(expanded?.paths).toEqual(["packages/{packageName}"]);
      expect(expanded?.must).toEqual({ haveFiles: ["README.md"] });
    }
  });

  it("expands a string-ref with mustNot predicates", () => {
    const sourceMap = buildSourceMap({
      common: [
        {
          description: "Do not export debug helpers.",
          mustNot: { exportConstants: ["debug"] },
          name: "no-debug",
          paths: ["packages/{packageName}"],
        },
      ],
    });

    const result = expandReferences({
      conventions: ["common/no-debug"],
      sourceMap,
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.conventions[0]?.mustNot).toEqual({
        exportConstants: ["debug"],
      });
    }
  });

  it("preserves an inherited condition on a string reference", () => {
    const sourceMap = buildSourceMap({
      common: [
        {
          description: "Runs only for matching packages.",
          if: { hasFile: "${packageName}.test.ts" },
          ifNot: { hasFile: "${packageName}.skip.ts" },
          must: { haveFiles: ["index.ts"] },
          name: "conditional-string",
          paths: "packages/{packageName}",
        },
      ],
    });

    const result = expandReferences({
      conventions: ["common/conditional-string"],
      sourceMap,
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.conventions[0]?.if).toEqual({
        hasFile: "${packageName}.test.ts",
      });
      expect(result.conventions[0]?.ifNot).toEqual({
        hasFile: "${packageName}.skip.ts",
      });
    }
  });

  it("emits the unknown-vendor error verbatim from the PRD", () => {
    const sourceMap: SourceMap = new Map();

    const result = expandReferences({
      conventions: ["missing/foo"],
      sourceMap,
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBe(
        'Unknown convention source "missing" referenced in conventions[0]. Declare it in conventionSources or fix the typo.'
      );
    }
  });

  it("emits the unknown-convention error with the available list", () => {
    const sourceMap = buildSourceMap({
      common: [
        {
          description: "x",
          must: { haveType: "file" },
          name: "available-one",
          paths: "src/*.ts",
        },
        {
          description: "x",
          must: { haveType: "file" },
          name: "available-two",
          paths: "src/*.ts",
        },
      ],
    });

    const result = expandReferences({
      conventions: ["common/missing"],
      sourceMap,
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBe(
        'No convention "missing" in source "common". The package exports: available-one, available-two.'
      );
    }
  });

  it("emits the paths-less error verbatim from the PRD", () => {
    const sourceMap = buildSourceMap({
      common: [
        {
          description: "x",
          must: { haveType: "file" },
          name: "no-paths",
        },
      ],
    });

    const result = expandReferences({
      conventions: ["common/no-paths"],
      sourceMap,
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBe(
        'Convention "common/no-paths" cannot be referenced by string; it has no "paths". Use { use: "common/no-paths", paths: [...] } form.'
      );
    }
  });

  it("passes hand-written entries through unchanged", () => {
    const handWritten: ConventionV1 = {
      must: { haveType: "file" },
      name: "manual",
      paths: "src/*.ts",
    };

    const result = expandReferences({
      conventions: [handWritten],
      sourceMap: new Map(),
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.conventions).toEqual([handWritten]);
      expect(result.conventions[0]).toBe(handWritten);
    }
  });

  it("preserves order in a mixed array of refs and hand-written entries", () => {
    const sourceMap = buildSourceMap({
      common: [
        {
          description: "x",
          must: { haveType: "file" },
          name: "first",
          paths: "src/*.ts",
        },
        {
          description: "x",
          must: { haveType: "directory" },
          name: "third",
          paths: "src/*.ts",
        },
      ],
    });
    const handWritten: ConventionV1 = {
      must: { haveType: "file" },
      name: "second",
      paths: "lib/*.ts",
    };

    const result = expandReferences({
      conventions: ["common/first", handWritten, "common/third"],
      sourceMap,
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.conventions.map((c) => c.name)).toEqual([
        "first",
        "second",
        "third",
      ]);
    }
  });

  it("includes the conventions[i] index in the unknown-vendor error", () => {
    const handWritten: ConventionV1 = {
      must: { haveType: "file" },
      paths: "src/*.ts",
    };

    const result = expandReferences({
      conventions: [handWritten, "missing/foo"],
      sourceMap: new Map(),
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toContain("conventions[1]");
    }
  });

  it("expands an object-ref and merges paths supplied at the use-site", () => {
    const sourceMap = buildSourceMap({
      common: [
        {
          description: "x",
          must: { haveFiles: ["README.md"] },
          name: "no-paths",
        },
      ],
    });

    const result = expandReferences({
      conventions: [
        {
          paths: ["packages/{packageName}"],
          use: "common/no-paths",
        },
      ],
      sourceMap,
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.conventions).toHaveLength(1);
      const [expanded] = result.conventions;
      expect(expanded?.name).toBe("no-paths");
      expect(expanded?.paths).toEqual(["packages/{packageName}"]);
      expect(expanded?.must).toEqual({ haveFiles: ["README.md"] });
    }
  });

  it("flows placeholders supplied at the use-site through to the expanded convention", () => {
    const sourceMap = buildSourceMap({
      common: [
        {
          description: "x",
          must: { exportValues: ["${providerId}"] },
          name: "provider-barrel",
        },
      ],
    });

    const result = expandReferences({
      conventions: [
        {
          paths: "packages/openai/src/index.ts",
          placeholders: { providerId: "openai" },
          use: "common/provider-barrel",
        },
      ],
      sourceMap,
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.conventions[0]?.placeholders).toEqual({
        providerId: "openai",
      });
    }
  });

  it("preserves an inherited condition on an object reference", () => {
    const sourceMap = buildSourceMap({
      common: [
        {
          description: "Runs only when a marker exists.",
          if: { hasFile: "marker.ts" },
          ifNot: { hasFile: "skip.ts" },
          must: { haveFiles: ["index.ts"] },
          name: "conditional-object",
        },
      ],
    });

    const result = expandReferences({
      conventions: [
        {
          paths: "packages/*",
          use: "common/conditional-object",
        },
      ],
      sourceMap,
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.conventions[0]?.if).toEqual({ hasFile: "marker.ts" });
      expect(result.conventions[0]?.ifNot).toEqual({ hasFile: "skip.ts" });
    }
  });

  it("replaces an inherited condition with the complete use-site condition", () => {
    const sourceMap = buildSourceMap({
      common: [
        {
          description: "Uses a consumer-specific gate.",
          if: { hasFile: "inherited-marker.ts" },
          ifNot: { hasFile: "inherited-skip.ts" },
          must: { haveFiles: ["index.ts"] },
          name: "conditional-override",
          paths: "packages/{packageName}",
        },
      ],
    });

    const result = expandReferences({
      conventions: [
        {
          if: {
            placeholderSatisfies: "packageName:matches(^public-)",
          },
          use: "common/conditional-override",
        },
      ],
      sourceMap,
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.conventions[0]?.if).toEqual({
        placeholderSatisfies: "packageName:matches(^public-)",
      });
      expect(result.conventions[0]?.ifNot).toEqual({
        hasFile: "inherited-skip.ts",
      });
    }
  });

  it("replaces an inherited ifNot condition independently", () => {
    const sourceMap = buildSourceMap({
      common: [
        {
          description: "Uses a consumer-specific negative gate.",
          if: { hasFile: "required-marker.ts" },
          ifNot: { hasFile: "inherited-skip.ts" },
          must: { haveFiles: ["index.ts"] },
          name: "negative-condition-override",
          paths: "packages/{packageName}",
        },
      ],
    });

    const result = expandReferences({
      conventions: [
        {
          ifNot: {
            placeholderSatisfies: "packageName:matches(^internal-)",
          },
          use: "common/negative-condition-override",
        },
      ],
      sourceMap,
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.conventions[0]?.if).toEqual({
        hasFile: "required-marker.ts",
      });
      expect(result.conventions[0]?.ifNot).toEqual({
        placeholderSatisfies: "packageName:matches(^internal-)",
      });
    }
  });

  it("validates placeholders in inherited and overridden conditions", () => {
    const sourceMap = buildSourceMap({
      common: [
        {
          description: "Uses condition placeholders.",
          if: { hasFile: "${missingInherited}.ts" },
          ifNot: { hasFile: "${missingInheritedNegative}.ts" },
          must: { haveFiles: ["index.ts"] },
          name: "conditional-placeholders",
          paths: "packages/*",
        },
      ],
    });

    const expansionResult = expandReferences({
      conventions: [
        "common/conditional-placeholders",
        {
          if: { hasValueImportFrom: "${missingOverride}" },
          ifNot: { hasTypeImportFrom: "${missingOverrideNegative}" },
          use: "common/conditional-placeholders",
        },
      ],
      sourceMap,
    });

    expect(expansionResult.success).toBe(true);
    if (expansionResult.success) {
      const validationResult = validatePlaceholders({
        conventions: expansionResult.conventions,
        identifiers: expansionResult.identifiers,
      });

      expect(validationResult.ok).toBe(false);
      if (!validationResult.ok) {
        expect(validationResult.error).toContain(
          'references "${missingInherited}" in if.hasFile'
        );
        expect(validationResult.error).toContain(
          'references "${missingOverride}" in if.hasValueImportFrom'
        );
        expect(validationResult.error).toContain(
          'references "${missingInheritedNegative}" in ifNot.hasFile'
        );
        expect(validationResult.error).toContain(
          'references "${missingOverrideNegative}" in ifNot.hasTypeImportFrom'
        );
      }
    }
  });

  it("replaces inherited arrays with override arrays (does not concatenate)", () => {
    const sourceMap = buildSourceMap({
      common: [
        {
          description: "x",
          excludeFiles: ["src/inherited.ts"],
          must: { haveType: "file" },
          name: "with-excludes",
          paths: "src/*.ts",
        },
      ],
    });

    const result = expandReferences({
      conventions: [
        {
          excludeFiles: ["src/override.ts"],
          use: "common/with-excludes",
        },
      ],
      sourceMap,
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.conventions[0]?.excludeFiles).toEqual(["src/override.ts"]);
    }
  });

  it("clears the inherited array when the override supplies an empty array", () => {
    const sourceMap = buildSourceMap({
      common: [
        {
          description: "x",
          excludeFiles: ["src/inherited.ts"],
          must: { haveType: "file" },
          name: "with-excludes",
          paths: "src/*.ts",
        },
      ],
    });

    const result = expandReferences({
      conventions: [
        {
          excludeFiles: [],
          use: "common/with-excludes",
        },
      ],
      sourceMap,
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.conventions[0]?.excludeFiles).toEqual([]);
    }
  });

  it("recursively merges nested must predicates without dropping inherited keys", () => {
    const sourceMap = buildSourceMap({
      common: [
        {
          description: "x",
          must: { exportValues: ["foo"] },
          name: "merge-must",
          paths: "src/*.ts",
        },
      ],
    });

    const result = expandReferences({
      conventions: [
        {
          must: { exportTypes: ["Bar"] },
          use: "common/merge-must",
        },
      ],
      sourceMap,
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.conventions[0]?.must).toEqual({
        exportTypes: ["Bar"],
        exportValues: ["foo"],
      });
    }
  });

  it("recursively merges nested mustNot predicates without dropping inherited keys", () => {
    const sourceMap = buildSourceMap({
      common: [
        {
          description: "x",
          mustNot: { exportValues: ["debug"] },
          name: "merge-must-not",
          paths: "src/*.ts",
        },
      ],
    });

    const result = expandReferences({
      conventions: [
        {
          mustNot: { exportTypes: ["Internal"] },
          use: "common/merge-must-not",
        },
      ],
      sourceMap,
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.conventions[0]?.mustNot).toEqual({
        exportTypes: ["Internal"],
        exportValues: ["debug"],
      });
    }
  });

  it("replaces primitive values like severity", () => {
    const sourceMap = buildSourceMap({
      common: [
        {
          description: "x",
          must: { haveType: "file" },
          name: "primitive-replace",
          paths: "src/*.ts",
          severity: "error",
        },
      ],
    });

    const result = expandReferences({
      conventions: [
        {
          severity: "warning",
          use: "common/primitive-replace",
        },
      ],
      sourceMap,
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.conventions[0]?.severity).toBe("warning");
    }
  });

  it("preserves order across a mix of bare-string, object-ref, and hand-written entries", () => {
    const sourceMap = buildSourceMap({
      common: [
        {
          description: "x",
          must: { haveType: "file" },
          name: "first",
          paths: "src/*.ts",
        },
        {
          description: "x",
          must: { haveType: "file" },
          name: "third",
          paths: "src/*.ts",
        },
      ],
    });
    const handWritten: ConventionV1 = {
      must: { haveType: "file" },
      name: "second",
      paths: "lib/*.ts",
    };
    const useForm = {
      severity: "warning" as const,
      use: "common/third",
    };

    const result = expandReferences({
      conventions: ["common/first", handWritten, useForm],
      sourceMap,
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.conventions.map((c) => c.name)).toEqual([
        "first",
        "second",
        "third",
      ]);
      expect(result.conventions[2]?.severity).toBe("warning");
    }
  });

  it("emits the unknown-vendor error for an object-ref", () => {
    const result = expandReferences({
      conventions: [{ use: "missing/foo" }],
      sourceMap: new Map(),
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBe(
        'Unknown convention source "missing" referenced in conventions[0]. Declare it in conventionSources or fix the typo.'
      );
    }
  });

  it("emits the unknown-convention error for an object-ref", () => {
    const sourceMap = buildSourceMap({
      common: [
        {
          description: "x",
          must: { haveType: "file" },
          name: "available-one",
          paths: "src/*.ts",
        },
      ],
    });

    const result = expandReferences({
      conventions: [{ use: "common/missing" }],
      sourceMap,
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBe(
        'No convention "missing" in source "common". The package exports: available-one.'
      );
    }
  });

  it("errors when the reusable convention has no paths and the override does not supply paths", () => {
    const sourceMap = buildSourceMap({
      common: [
        {
          description: "x",
          must: { haveType: "file" },
          name: "no-paths",
        },
      ],
    });

    const result = expandReferences({
      conventions: [{ use: "common/no-paths" }],
      sourceMap,
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBe(
        'Convention "common/no-paths" referenced in conventions[0] has no "paths". Either the reusable convention must declare paths, or the override must supply paths.'
      );
    }
  });

  it("succeeds when the reusable convention has no paths but the override supplies paths", () => {
    const sourceMap = buildSourceMap({
      common: [
        {
          description: "x",
          must: { haveType: "file" },
          name: "no-paths",
        },
      ],
    });

    const result = expandReferences({
      conventions: [
        {
          paths: "src/*.ts",
          use: "common/no-paths",
        },
      ],
      sourceMap,
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.conventions[0]?.paths).toBe("src/*.ts");
    }
  });

  it("expands a string reference nested inside a hand-written must[]", () => {
    const sourceMap = buildSourceMap({
      common: [
        {
          description: "Block requiring a README.md.",
          must: { haveFiles: ["README.md"] },
          name: "needs-readme",
        },
      ],
    });

    const handWritten = {
      must: [{ must: { haveType: "directory" } }, "common/needs-readme"],
      paths: "packages/{packageName}",
    } as Parameters<typeof expandReferences>[0]["conventions"][number];

    const result = expandReferences({
      conventions: [handWritten],
      sourceMap,
    });

    expect(result.success).toBe(true);
    if (result.success) {
      const must = result.conventions[0]?.must;
      if (Array.isArray(must)) {
        expect(must).toHaveLength(2);
        expect(must[1]).toEqual({
          description: "Block requiring a README.md.",
          must: { haveFiles: ["README.md"] },
          name: "needs-readme",
        });
      }
    }
  });

  it("expands a mustNot string reference nested inside a hand-written must[]", () => {
    const sourceMap = buildSourceMap({
      common: [
        {
          description: "Block forbidding debug exports.",
          mustNot: { exportConstants: ["debug"] },
          name: "no-debug",
        },
      ],
    });

    const handWritten = {
      must: ["common/no-debug"],
      paths: "packages/{packageName}",
    } as Parameters<typeof expandReferences>[0]["conventions"][number];

    const result = expandReferences({
      conventions: [handWritten],
      sourceMap,
    });

    expect(result.success).toBe(true);
    if (result.success) {
      const must = result.conventions[0]?.must;
      if (Array.isArray(must)) {
        expect(must[0]).toEqual({
          description: "Block forbidding debug exports.",
          mustNot: { exportConstants: ["debug"] },
          name: "no-debug",
        });
      }
    }
  });

  it("errors when a string reference inside must[] points at a reusable with paths", () => {
    const sourceMap = buildSourceMap({
      common: [
        {
          description: "x",
          must: { haveType: "file" },
          name: "with-paths",
          paths: "src/*.ts",
        },
      ],
    });

    const handWritten = {
      must: ["common/with-paths"],
      paths: "packages/{packageName}",
    } as Parameters<typeof expandReferences>[0]["conventions"][number];

    const result = expandReferences({
      conventions: [handWritten],
      sourceMap,
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toContain("conventions[0].must[0]");
      expect(result.error).toContain('"paths"');
    }
  });

  it("expands a use ref nested inside a hand-written must[]", () => {
    const sourceMap = buildSourceMap({
      common: [
        {
          description: "Block requiring a README.md.",
          must: { haveFiles: ["README.md"] },
          name: "needs-readme",
        },
      ],
    });

    const handWritten = {
      must: [
        { must: { haveType: "directory" } },
        { use: "common/needs-readme" },
      ],
      paths: "packages/{packageName}",
    } as Parameters<typeof expandReferences>[0]["conventions"][number];

    const result = expandReferences({
      conventions: [handWritten],
      sourceMap,
    });

    expect(result.success).toBe(true);
    if (result.success) {
      const must = result.conventions[0]?.must;
      expect(Array.isArray(must)).toBe(true);
      if (Array.isArray(must)) {
        expect(must).toHaveLength(2);
        expect(must[1]).toEqual({
          description: "Block requiring a README.md.",
          must: { haveFiles: ["README.md"] },
          name: "needs-readme",
        });
      }
    }
  });

  it("preserves and atomically overrides conditions for a nested use ref", () => {
    const sourceMap = buildSourceMap({
      common: [
        {
          description: "Conditionally requires an index.",
          if: { hasFile: "inherited-marker.ts" },
          ifNot: { hasFile: "inherited-skip.ts" },
          must: { haveFiles: ["index.ts"] },
          name: "conditional-block",
        },
      ],
    });

    const handWritten = {
      must: [
        "common/conditional-block",
        {
          if: { placeholderSatisfies: "packageName:segments(1)" },
          use: "common/conditional-block",
        },
      ],
      paths: "packages/{packageName}",
    } as Parameters<typeof expandReferences>[0]["conventions"][number];

    const result = expandReferences({
      conventions: [handWritten],
      sourceMap,
    });

    expect(result.success).toBe(true);
    if (result.success) {
      const must = result.conventions[0]?.must;
      if (Array.isArray(must)) {
        expect(must[0]?.if).toEqual({ hasFile: "inherited-marker.ts" });
        expect(must[0]?.ifNot).toEqual({ hasFile: "inherited-skip.ts" });
        expect(must[1]?.if).toEqual({
          placeholderSatisfies: "packageName:segments(1)",
        });
        expect(must[1]?.ifNot).toEqual({ hasFile: "inherited-skip.ts" });
      }
    }
  });

  it("deep-merges override.must onto the inherited predicates inside must[]", () => {
    const sourceMap = buildSourceMap({
      common: [
        {
          description: "x",
          must: { haveFiles: ["README.md"] },
          name: "base-block",
        },
      ],
    });

    const handWritten = {
      must: [
        {
          for: { files: "{packageName}/index.ts" },
          must: { exportTypes: ["Public"] },
          use: "common/base-block",
        },
      ],
      paths: "packages/{packageName}",
    } as Parameters<typeof expandReferences>[0]["conventions"][number];

    const result = expandReferences({
      conventions: [handWritten],
      sourceMap,
    });

    expect(result.success).toBe(true);
    if (result.success) {
      const must = result.conventions[0]?.must;
      if (Array.isArray(must)) {
        expect(must[0]).toEqual({
          description: "x",
          for: { files: "{packageName}/index.ts" },
          must: { exportTypes: ["Public"], haveFiles: ["README.md"] },
          name: "base-block",
        });
      }
    }
  });

  it("deep-merges override.mustNot onto inherited predicates inside must[]", () => {
    const sourceMap = buildSourceMap({
      common: [
        {
          description: "x",
          mustNot: { exportValues: ["debug"] },
          name: "base-block",
        },
      ],
    });

    const handWritten = {
      must: [
        {
          mustNot: { exportTypes: ["Internal"] },
          use: "common/base-block",
        },
      ],
      paths: "packages/{packageName}",
    } as Parameters<typeof expandReferences>[0]["conventions"][number];

    const result = expandReferences({
      conventions: [handWritten],
      sourceMap,
    });

    expect(result.success).toBe(true);
    if (result.success) {
      const must = result.conventions[0]?.must;
      if (Array.isArray(must)) {
        expect(must[0]).toEqual({
          description: "x",
          mustNot: { exportTypes: ["Internal"], exportValues: ["debug"] },
          name: "base-block",
        });
      }
    }
  });

  it("errors when a must[] use ref points to a reusable that declares paths", () => {
    const sourceMap = buildSourceMap({
      common: [
        {
          description: "x",
          must: { haveType: "file" },
          name: "with-paths",
          paths: "src/*.ts",
        },
      ],
    });

    const handWritten = {
      must: [{ use: "common/with-paths" }],
      paths: "packages/{packageName}",
    } as Parameters<typeof expandReferences>[0]["conventions"][number];

    const result = expandReferences({
      conventions: [handWritten],
      sourceMap,
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toContain("conventions[0].must[0]");
      expect(result.error).toContain('"paths"');
      expect(result.error).toContain("top-level-only");
    }
  });

  it("errors when a must[] use ref points to a reusable that declares severity", () => {
    const sourceMap = buildSourceMap({
      common: [
        {
          description: "x",
          must: { haveType: "file" },
          name: "with-severity",
          severity: "warning",
        },
      ],
    });

    const handWritten = {
      must: [{ use: "common/with-severity" }],
      paths: "packages/{packageName}",
    } as Parameters<typeof expandReferences>[0]["conventions"][number];

    const result = expandReferences({
      conventions: [handWritten],
      sourceMap,
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toContain('"severity"');
    }
  });

  it("emits an unknown-source error scoped to conventions[i].must[j]", () => {
    const handWritten = {
      must: [{ use: "missing/foo" }],
      paths: "packages/{packageName}",
    } as Parameters<typeof expandReferences>[0]["conventions"][number];

    const result = expandReferences({
      conventions: [handWritten],
      sourceMap: new Map(),
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toContain("conventions[0].must[0]");
      expect(result.error).toContain('Unknown convention source "missing"');
    }
  });

  it("includes conventions.<i> in the path of Zod errors when the merged result is invalid", () => {
    const sourceMap = buildSourceMap({
      common: [
        {
          description: "x",
          must: { haveType: "file" },
          name: "ok",
          paths: "src/*.ts",
        },
      ],
    });

    const malformedEntry = JSON.parse(
      '{ "use": "common/ok", "severity": "bogus" }'
    ) as Parameters<typeof expandReferences>[0]["conventions"][number];
    const result = expandReferences({
      conventions: [malformedEntry],
      sourceMap,
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toContain("conventions.0");
      expect(result.error).toContain("Invalid input");
    }
  });
});
