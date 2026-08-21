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
          name: "package-must-have-readme",
          description: "Every package must have a README.md.",
          paths: ["packages/{packageName}"],
          must: { haveFiles: ["README.md"] },
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
      const expanded = result.conventions[0];
      expect(expanded?.name).toBe("package-must-have-readme");
      expect(expanded?.paths).toEqual(["packages/{packageName}"]);
      expect(expanded?.must).toEqual({ haveFiles: ["README.md"] });
    }
  });

  it("expands a string-ref with mustNot predicates", () => {
    const sourceMap = buildSourceMap({
      common: [
        {
          name: "no-debug",
          description: "Do not export debug helpers.",
          paths: ["packages/{packageName}"],
          mustNot: { exportConstants: ["debug"] },
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
          name: "conditional-string",
          description: "Runs only for matching packages.",
          paths: "packages/{packageName}",
          if: { hasFile: "${packageName}.test.ts" },
          must: { haveFiles: ["index.ts"] },
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
          name: "available-one",
          description: "x",
          paths: "src/*.ts",
          must: { haveType: "file" },
        },
        {
          name: "available-two",
          description: "x",
          paths: "src/*.ts",
          must: { haveType: "file" },
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
          name: "no-paths",
          description: "x",
          must: { haveType: "file" },
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
      name: "manual",
      paths: "src/*.ts",
      must: { haveType: "file" },
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
          name: "first",
          description: "x",
          paths: "src/*.ts",
          must: { haveType: "file" },
        },
        {
          name: "third",
          description: "x",
          paths: "src/*.ts",
          must: { haveType: "directory" },
        },
      ],
    });
    const handWritten: ConventionV1 = {
      name: "second",
      paths: "lib/*.ts",
      must: { haveType: "file" },
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
      paths: "src/*.ts",
      must: { haveType: "file" },
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
          name: "no-paths",
          description: "x",
          must: { haveFiles: ["README.md"] },
        },
      ],
    });

    const result = expandReferences({
      conventions: [
        {
          use: "common/no-paths",
          paths: ["packages/{packageName}"],
        },
      ],
      sourceMap,
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.conventions).toHaveLength(1);
      const expanded = result.conventions[0];
      expect(expanded?.name).toBe("no-paths");
      expect(expanded?.paths).toEqual(["packages/{packageName}"]);
      expect(expanded?.must).toEqual({ haveFiles: ["README.md"] });
    }
  });

  it("flows placeholders supplied at the use-site through to the expanded convention", () => {
    const sourceMap = buildSourceMap({
      common: [
        {
          name: "provider-barrel",
          description: "x",
          must: { exportValues: ["${providerId}"] },
        },
      ],
    });

    const result = expandReferences({
      conventions: [
        {
          use: "common/provider-barrel",
          paths: "packages/openai/src/index.ts",
          placeholders: { providerId: "openai" },
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
          name: "conditional-object",
          description: "Runs only when a marker exists.",
          if: { hasFile: "marker.ts" },
          must: { haveFiles: ["index.ts"] },
        },
      ],
    });

    const result = expandReferences({
      conventions: [
        {
          use: "common/conditional-object",
          paths: "packages/*",
        },
      ],
      sourceMap,
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.conventions[0]?.if).toEqual({ hasFile: "marker.ts" });
    }
  });

  it("replaces an inherited condition with the complete use-site condition", () => {
    const sourceMap = buildSourceMap({
      common: [
        {
          name: "conditional-override",
          description: "Uses a consumer-specific gate.",
          paths: "packages/{packageName}",
          if: { hasFile: "inherited-marker.ts" },
          must: { haveFiles: ["index.ts"] },
        },
      ],
    });

    const result = expandReferences({
      conventions: [
        {
          use: "common/conditional-override",
          if: {
            placeholderSatisfies: "packageName:matches(^public-)",
          },
        },
      ],
      sourceMap,
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.conventions[0]?.if).toEqual({
        placeholderSatisfies: "packageName:matches(^public-)",
      });
    }
  });

  it("validates placeholders in inherited and overridden conditions", () => {
    const sourceMap = buildSourceMap({
      common: [
        {
          name: "conditional-placeholders",
          description: "Uses condition placeholders.",
          paths: "packages/*",
          if: { hasFile: "${missingInherited}.ts" },
          must: { haveFiles: ["index.ts"] },
        },
      ],
    });

    const expansionResult = expandReferences({
      conventions: [
        "common/conditional-placeholders",
        {
          use: "common/conditional-placeholders",
          if: { hasValueImportFrom: "${missingOverride}" },
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
      }
    }
  });

  it("replaces inherited arrays with override arrays (does not concatenate)", () => {
    const sourceMap = buildSourceMap({
      common: [
        {
          name: "with-excludes",
          description: "x",
          paths: "src/*.ts",
          excludeFiles: ["src/inherited.ts"],
          must: { haveType: "file" },
        },
      ],
    });

    const result = expandReferences({
      conventions: [
        {
          use: "common/with-excludes",
          excludeFiles: ["src/override.ts"],
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
          name: "with-excludes",
          description: "x",
          paths: "src/*.ts",
          excludeFiles: ["src/inherited.ts"],
          must: { haveType: "file" },
        },
      ],
    });

    const result = expandReferences({
      conventions: [
        {
          use: "common/with-excludes",
          excludeFiles: [],
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
          name: "merge-must",
          description: "x",
          paths: "src/*.ts",
          must: { exportValues: ["foo"] },
        },
      ],
    });

    const result = expandReferences({
      conventions: [
        {
          use: "common/merge-must",
          must: { exportTypes: ["Bar"] },
        },
      ],
      sourceMap,
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.conventions[0]?.must).toEqual({
        exportValues: ["foo"],
        exportTypes: ["Bar"],
      });
    }
  });

  it("recursively merges nested mustNot predicates without dropping inherited keys", () => {
    const sourceMap = buildSourceMap({
      common: [
        {
          name: "merge-must-not",
          description: "x",
          paths: "src/*.ts",
          mustNot: { exportValues: ["debug"] },
        },
      ],
    });

    const result = expandReferences({
      conventions: [
        {
          use: "common/merge-must-not",
          mustNot: { exportTypes: ["Internal"] },
        },
      ],
      sourceMap,
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.conventions[0]?.mustNot).toEqual({
        exportValues: ["debug"],
        exportTypes: ["Internal"],
      });
    }
  });

  it("replaces primitive values like severity", () => {
    const sourceMap = buildSourceMap({
      common: [
        {
          name: "primitive-replace",
          description: "x",
          paths: "src/*.ts",
          severity: "error",
          must: { haveType: "file" },
        },
      ],
    });

    const result = expandReferences({
      conventions: [
        {
          use: "common/primitive-replace",
          severity: "warning",
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
          name: "first",
          description: "x",
          paths: "src/*.ts",
          must: { haveType: "file" },
        },
        {
          name: "third",
          description: "x",
          paths: "src/*.ts",
          must: { haveType: "file" },
        },
      ],
    });
    const handWritten: ConventionV1 = {
      name: "second",
      paths: "lib/*.ts",
      must: { haveType: "file" },
    };
    const useForm = {
      use: "common/third",
      severity: "warning" as const,
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
          name: "available-one",
          description: "x",
          paths: "src/*.ts",
          must: { haveType: "file" },
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
          name: "no-paths",
          description: "x",
          must: { haveType: "file" },
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
          name: "no-paths",
          description: "x",
          must: { haveType: "file" },
        },
      ],
    });

    const result = expandReferences({
      conventions: [
        {
          use: "common/no-paths",
          paths: "src/*.ts",
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
          name: "needs-readme",
          description: "Block requiring a README.md.",
          must: { haveFiles: ["README.md"] },
        },
      ],
    });

    const handWritten = {
      paths: "packages/{packageName}",
      must: [{ must: { haveType: "directory" } }, "common/needs-readme"],
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
          name: "needs-readme",
          description: "Block requiring a README.md.",
          must: { haveFiles: ["README.md"] },
        });
      }
    }
  });

  it("expands a mustNot string reference nested inside a hand-written must[]", () => {
    const sourceMap = buildSourceMap({
      common: [
        {
          name: "no-debug",
          description: "Block forbidding debug exports.",
          mustNot: { exportConstants: ["debug"] },
        },
      ],
    });

    const handWritten = {
      paths: "packages/{packageName}",
      must: ["common/no-debug"],
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
          name: "no-debug",
          description: "Block forbidding debug exports.",
          mustNot: { exportConstants: ["debug"] },
        });
      }
    }
  });

  it("errors when a string reference inside must[] points at a reusable with paths", () => {
    const sourceMap = buildSourceMap({
      common: [
        {
          name: "with-paths",
          description: "x",
          paths: "src/*.ts",
          must: { haveType: "file" },
        },
      ],
    });

    const handWritten = {
      paths: "packages/{packageName}",
      must: ["common/with-paths"],
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
          name: "needs-readme",
          description: "Block requiring a README.md.",
          must: { haveFiles: ["README.md"] },
        },
      ],
    });

    const handWritten = {
      paths: "packages/{packageName}",
      must: [
        { must: { haveType: "directory" } },
        { use: "common/needs-readme" },
      ],
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
          name: "needs-readme",
          description: "Block requiring a README.md.",
          must: { haveFiles: ["README.md"] },
        });
      }
    }
  });

  it("preserves and atomically overrides conditions for a nested use ref", () => {
    const sourceMap = buildSourceMap({
      common: [
        {
          name: "conditional-block",
          description: "Conditionally requires an index.",
          if: { hasFile: "inherited-marker.ts" },
          must: { haveFiles: ["index.ts"] },
        },
      ],
    });

    const handWritten = {
      paths: "packages/{packageName}",
      must: [
        "common/conditional-block",
        {
          use: "common/conditional-block",
          if: { placeholderSatisfies: "packageName:segments(1)" },
        },
      ],
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
        expect(must[1]?.if).toEqual({
          placeholderSatisfies: "packageName:segments(1)",
        });
      }
    }
  });

  it("deep-merges override.must onto the inherited predicates inside must[]", () => {
    const sourceMap = buildSourceMap({
      common: [
        {
          name: "base-block",
          description: "x",
          must: { haveFiles: ["README.md"] },
        },
      ],
    });

    const handWritten = {
      paths: "packages/{packageName}",
      must: [
        {
          use: "common/base-block",
          for: { files: "{packageName}/index.ts" },
          must: { exportTypes: ["Public"] },
        },
      ],
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
          name: "base-block",
          description: "x",
          for: { files: "{packageName}/index.ts" },
          must: { haveFiles: ["README.md"], exportTypes: ["Public"] },
        });
      }
    }
  });

  it("deep-merges override.mustNot onto inherited predicates inside must[]", () => {
    const sourceMap = buildSourceMap({
      common: [
        {
          name: "base-block",
          description: "x",
          mustNot: { exportValues: ["debug"] },
        },
      ],
    });

    const handWritten = {
      paths: "packages/{packageName}",
      must: [
        {
          use: "common/base-block",
          mustNot: { exportTypes: ["Internal"] },
        },
      ],
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
          name: "base-block",
          description: "x",
          mustNot: { exportValues: ["debug"], exportTypes: ["Internal"] },
        });
      }
    }
  });

  it("errors when a must[] use ref points to a reusable that declares paths", () => {
    const sourceMap = buildSourceMap({
      common: [
        {
          name: "with-paths",
          description: "x",
          paths: "src/*.ts",
          must: { haveType: "file" },
        },
      ],
    });

    const handWritten = {
      paths: "packages/{packageName}",
      must: [{ use: "common/with-paths" }],
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
          name: "with-severity",
          description: "x",
          severity: "warning",
          must: { haveType: "file" },
        },
      ],
    });

    const handWritten = {
      paths: "packages/{packageName}",
      must: [{ use: "common/with-severity" }],
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
      paths: "packages/{packageName}",
      must: [{ use: "missing/foo" }],
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
          name: "ok",
          description: "x",
          paths: "src/*.ts",
          must: { haveType: "file" },
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
