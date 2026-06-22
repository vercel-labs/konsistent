import { describe, expect, it } from "vitest";
import { validatePlaceholders } from "./placeholder-validator.js";
import type { ConventionV1 } from "./schema.js";

describe("validatePlaceholders", () => {
  it("accepts a placeholder declared in paths and used in must.haveFiles", () => {
    const conventions: ConventionV1[] = [
      {
        name: "package-must-have-readme",
        paths: ["packages/{packageName}"],
        must: { haveFiles: ["${packageName}/README.md"] },
      },
    ];

    const result = validatePlaceholders({
      conventions,
      identifiers: ["common/package-must-have-readme"],
    });

    expect(result.ok).toBe(true);
  });

  it("rejects a placeholder used in must but absent from paths", () => {
    const conventions: ConventionV1[] = [
      {
        name: "broken",
        paths: ["packages/{packageName}"],
        must: { haveFiles: ["${componentName}.tsx"] },
      },
    ];

    const result = validatePlaceholders({
      conventions,
      identifiers: ["broken"],
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBe(
        'Convention "broken" references "${componentName}" in must.haveFiles, but neither paths nor placeholders declare "{componentName}".'
      );
    }
  });

  it("rejects a placeholder used in mustNot but absent from paths", () => {
    const conventions: ConventionV1[] = [
      {
        name: "broken",
        paths: ["packages/{packageName}"],
        mustNot: { exportConstants: ["${componentName}Debug"] },
      },
    ];

    const result = validatePlaceholders({
      conventions,
      identifiers: ["broken"],
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBe(
        'Convention "broken" references "${componentName}" in mustNot.exportConstants, but neither paths nor placeholders declare "{componentName}".'
      );
    }
  });

  it("reports only the missing placeholder when multiple are used and one is missing", () => {
    const conventions: ConventionV1[] = [
      {
        name: "partial",
        paths: ["packages/{packageName}"],
        must: { haveFiles: ["${packageName}/${missing}.ts"] },
      },
    ];

    const result = validatePlaceholders({
      conventions,
      identifiers: ["partial"],
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain('"${missing}"');
      expect(result.error).not.toContain('"${packageName}"');
    }
  });

  it("detects a placeholder inside an object-form export entry", () => {
    const conventions: ConventionV1[] = [
      {
        name: "object-export",
        paths: ["src/{x}"],
        must: {
          export: [{ name: "${X}", from: "${Y}" }],
        },
      },
    ];

    const result = validatePlaceholders({
      conventions,
      identifiers: ["object-export"],
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain('"${X}"');
      expect(result.error).toContain("must.export");
    }
  });

  it("detects a placeholder inside a nested MustBlock predicate", () => {
    const conventions: ConventionV1[] = [
      {
        name: "block-form",
        paths: ["packages/{packageName}"],
        must: [
          {
            if: { hasFile: "${missing}.ts" },
            must: { haveFiles: ["index.ts"] },
          },
        ],
      },
    ];

    const result = validatePlaceholders({
      conventions,
      identifiers: ["block-form"],
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain('"${missing}"');
      expect(result.error).toContain("must.if.hasFile");
    }
  });

  it("detects a placeholder inside a nested MustBlock mustNot predicate", () => {
    const conventions: ConventionV1[] = [
      {
        name: "block-form",
        paths: ["packages/{packageName}"],
        must: [
          {
            mustNot: { exportConstants: ["${missing}Debug"] },
          },
        ],
      },
    ];

    const result = validatePlaceholders({
      conventions,
      identifiers: ["block-form"],
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain('"${missing}"');
      expect(result.error).toContain("mustNot.exportConstants");
    }
  });

  it("scans a single-string paths value for declared placeholders", () => {
    const conventions: ConventionV1[] = [
      {
        name: "single-path",
        paths: "packages/{packageName}",
        must: { haveFiles: ["${packageName}/README.md"] },
      },
    ];

    const result = validatePlaceholders({
      conventions,
      identifiers: ["single-path"],
    });

    expect(result.ok).toBe(true);
  });

  it("uses the convention name when hand-written without a name field falls back to conventions[i]", () => {
    const conventions: ConventionV1[] = [
      {
        paths: ["src/{x}"],
        must: { haveFiles: ["${missing}.ts"] },
      },
    ];

    const result = validatePlaceholders({
      conventions,
      identifiers: ["conventions[0]"],
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain('Convention "conventions[0]"');
    }
  });

  it("uses the hand-written convention name when supplied", () => {
    const conventions: ConventionV1[] = [
      {
        name: "manual",
        paths: ["src/{x}"],
        must: { haveFiles: ["${missing}.ts"] },
      },
    ];

    const result = validatePlaceholders({
      conventions,
      identifiers: ["manual"],
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain('Convention "manual"');
    }
  });

  it("uses the <vendor>/<name> identifier for ref-expanded conventions", () => {
    const conventions: ConventionV1[] = [
      {
        name: "package-must-have-readme",
        paths: ["packages/{packageName}"],
        must: { haveFiles: ["${componentName}.tsx"] },
      },
    ];

    const result = validatePlaceholders({
      conventions,
      identifiers: ["common/package-must-have-readme"],
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain(
        'Convention "common/package-must-have-readme"'
      );
    }
  });

  it("reports placeholders inside placeholderSatisfies", () => {
    const conventions: ConventionV1[] = [
      {
        name: "satisfies",
        paths: ["packages/{packageName}"],
        must: [
          {
            if: { placeholderSatisfies: "${missing}.matches(/foo/)" },
            must: { haveFiles: ["index.ts"] },
          },
        ],
      },
    ];

    const result = validatePlaceholders({
      conventions,
      identifiers: ["satisfies"],
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain("must.if.placeholderSatisfies");
    }
  });

  it("reports placeholders inside for.files (string and array form)", () => {
    const stringForm: ConventionV1[] = [
      {
        name: "for-string",
        paths: ["packages/{packageName}"],
        must: [
          {
            for: { files: "${missing}.ts" },
            must: { haveFiles: ["index.ts"] },
          },
        ],
      },
    ];
    const arrayForm: ConventionV1[] = [
      {
        name: "for-array",
        paths: ["packages/{packageName}"],
        must: [
          {
            for: { files: ["${missing}.ts"] },
            must: { haveFiles: ["index.ts"] },
          },
        ],
      },
    ];

    expect(
      validatePlaceholders({
        conventions: stringForm,
        identifiers: ["for-string"],
      }).ok
    ).toBe(false);
    expect(
      validatePlaceholders({
        conventions: arrayForm,
        identifiers: ["for-array"],
      }).ok
    ).toBe(false);
  });

  it("detects placeholders inside class extend and implement entries", () => {
    const conventions: ConventionV1[] = [
      {
        name: "classes",
        paths: ["src/{x}"],
        must: {
          exportClasses: [
            {
              name: "Foo",
              extend: { type: "${missing}", allowOmissions: true },
              implement: ["${alsoMissing}"],
            },
          ],
        },
      },
    ];

    const result = validatePlaceholders({
      conventions,
      identifiers: ["classes"],
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain('"${missing}"');
      expect(result.error).toContain('"${alsoMissing}"');
    }
  });

  it("detects placeholders inside declaration predicates", () => {
    const conventions: ConventionV1[] = [
      {
        name: "declarations",
        paths: ["src/{x}"],
        must: {
          declareTypes: [{ name: "${missingType}" }],
          declareConstants: ["${missingConstant}"],
          declareFunctions: [
            {
              name: "create${missingFunction}",
              receiveParamOfType: "${missingParam}",
              receiveParamsOfTypes: ["${missingParamAtIndex}"],
              returnValueOfType: "${missingReturn}",
            },
          ],
          declareInterfaces: [
            {
              name: "Local",
              extend: { type: "${missingExtend}", allowOmissions: true },
            },
          ],
          declareClasses: [
            {
              name: "LocalClass",
              implement: ["${missingImplement}"],
            },
          ],
          useDeclarationOrder: ["${missingOrder}"],
        },
      },
    ];

    const result = validatePlaceholders({
      conventions,
      identifiers: ["declarations"],
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain('"${missingType}"');
      expect(result.error).toContain('"${missingParamAtIndex}"');
      expect(result.error).toContain("must.declareTypes");
      expect(result.error).toContain("must.declareFunctions");
    }
  });

  it("treats placeholders declared in for.files as in-scope for the block's predicates", () => {
    const conventions: ConventionV1[] = [
      {
        name: "for-declares",
        paths: "packages/{providerId}",
        must: [
          {
            for: { files: "*/${providerId}-{modelKind:segments(2)}-model.ts" },
            must: {
              exportFunctions: ["create${providerId}${modelKind}"],
            },
          },
        ],
      },
    ];

    const result = validatePlaceholders({
      conventions,
      identifiers: ["for-declares"],
    });

    expect(result.ok).toBe(true);
  });

  it("treats constraint syntax in paths as a valid declaration", () => {
    const conventions: ConventionV1[] = [
      {
        name: "constraint-paths",
        paths: "packages/{providerId:matches(^[a-z]+$)}",
        must: { haveFiles: ["${providerId}.ts"] },
      },
    ];

    const result = validatePlaceholders({
      conventions,
      identifiers: ["constraint-paths"],
    });

    expect(result.ok).toBe(true);
  });

  it("accepts a usage backed by a static placeholders entry", () => {
    const conventions: ConventionV1[] = [
      {
        name: "static-providers",
        paths: "packages/openai/src/index.ts",
        placeholders: { providerId: "openai" },
        must: { export: ["${providerId}"] },
      },
    ];

    const result = validatePlaceholders({
      conventions,
      identifiers: ["static-providers"],
    });

    expect(result.ok).toBe(true);
  });

  it("rejects a name declared in both paths and placeholders", () => {
    const conventions: ConventionV1[] = [
      {
        name: "double-declared",
        paths: "packages/{providerId}/src/index.ts",
        placeholders: { providerId: "openai" },
        must: { export: ["${providerId}"] },
      },
    ];

    const result = validatePlaceholders({
      conventions,
      identifiers: ["double-declared"],
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain(
        'Convention "double-declared" declares placeholder "providerId" both in paths (as "{providerId}") and in placeholders. Pick one.'
      );
    }
  });

  it("returns ok when no must placeholders are used", () => {
    const conventions: ConventionV1[] = [
      {
        name: "static",
        paths: "src/lib",
        must: { haveType: "directory", haveFiles: ["index.ts"] },
      },
    ];

    const result = validatePlaceholders({
      conventions,
      identifiers: ["static"],
    });

    expect(result.ok).toBe(true);
  });
});
