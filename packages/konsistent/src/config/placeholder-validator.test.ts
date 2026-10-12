import { describe, expect, it } from "vitest";
import { validatePlaceholders } from "./placeholder-validator.js";
import type { ConventionV1 } from "./schema.js";

describe("validatePlaceholders", () => {
  it("checks placeholders in directory conditions and predicates", () => {
    const conventions: ConventionV1[] = [
      {
        must: [
          {
            if: { hasDirectory: "${unknown}/*" },
            must: { haveDirectories: ["${module}/src"] },
            mustNot: { haveDirectories: ["${missing}/*"] },
          },
        ],
        name: "directory-check",
        paths: "modules/{module}",
      },
    ];
    const result = validatePlaceholders({
      conventions,
      identifiers: ["directory-check"],
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain("if.hasDirectory");
      expect(result.error).toContain("mustNot.haveDirectories");
      expect(result.error).not.toContain('"${module}"');
    }
  });
  it("accepts a placeholder declared in paths and used in must.haveFiles", () => {
    const conventions: ConventionV1[] = [
      {
        must: { haveFiles: ["${packageName}/README.md"] },
        name: "package-must-have-readme",
        paths: ["packages/{packageName}"],
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
        must: { haveFiles: ["${componentName}.tsx"] },
        name: "broken",
        paths: ["packages/{packageName}"],
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
        mustNot: { exportConstants: ["${componentName}Debug"] },
        name: "broken",
        paths: ["packages/{packageName}"],
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
        must: { haveFiles: ["${packageName}/${missing}.ts"] },
        name: "partial",
        paths: ["packages/{packageName}"],
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
        must: {
          exportValues: [{ from: "${Y}", name: "${X}" }],
        },
        name: "object-export",
        paths: ["src/{x}"],
      },
    ];

    const result = validatePlaceholders({
      conventions,
      identifiers: ["object-export"],
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain('"${X}"');
      expect(result.error).toContain("must.exportValues");
    }
  });

  it("accepts declared placeholders in inner type constraints", () => {
    const conventions: ConventionV1[] = [
      {
        must: {
          declareTypes: [
            {
              name: "InternalSettings",
              schema: {
                items: "${harnessId.toPascalCase()}Data",
                type: "array",
              },
            },
          ],
          exportTypes: [
            {
              name: "Settings",
              schema: {
                properties: {
                  data: "${harnessId.toPascalCase()}Data",
                },
                type: "object",
              },
            },
          ],
        },
        name: "schema-types",
        paths: ["src/{harnessId}.ts"],
      },
    ];

    expect(
      validatePlaceholders({
        conventions,
        identifiers: ["schema-types"],
      })
    ).toEqual({ ok: true });
  });

  it("rejects undeclared placeholders in inner type constraints", () => {
    const conventions: ConventionV1[] = [
      {
        must: {
          declareConstants: [
            {
              name: "data",
              schema: {
                items: "${missingArrayType}",
                type: "array",
              },
            },
          ],
          exportConstants: [
            {
              name: "data",
              schema: {
                properties: { data: "${missingPropertyType}" },
                type: "object",
              },
            },
          ],
        },
        name: "schema-types",
        paths: ["src/{harnessId}.ts"],
      },
    ];

    const result = validatePlaceholders({
      conventions,
      identifiers: ["schema-types"],
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain('"${missingArrayType}"');
      expect(result.error).toContain("must.declareConstants");
      expect(result.error).toContain('"${missingPropertyType}"');
      expect(result.error).toContain("must.exportConstants");
    }
  });

  it("validates placeholders in top-level type constraints", () => {
    const conventions: ConventionV1[] = [
      {
        must: {
          declareTypes: [
            {
              name: "InternalSettings",
              type: "${harnessId.toPascalCase()}Settings<'internal'>",
            },
          ],
          exportConstants: [
            {
              name: "settings",
              type: "${harnessId.toPascalCase()}Settings<'public'>",
            },
          ],
        },
        name: "exact-types",
        paths: ["src/{harnessId}.ts"],
      },
    ];

    expect(
      validatePlaceholders({
        conventions,
        identifiers: ["exact-types"],
      })
    ).toEqual({ ok: true });
  });

  it("rejects undeclared placeholders in top-level type constraints", () => {
    const conventions: ConventionV1[] = [
      {
        must: {
          declareConstants: [
            { name: "internalSettings", type: "${missingLocal}Settings" },
          ],
          exportTypes: [{ name: "Settings", type: "${missingExport}Settings" }],
        },
        name: "exact-types",
        paths: ["src/{harnessId}.ts"],
      },
    ];

    const result = validatePlaceholders({
      conventions,
      identifiers: ["exact-types"],
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain('"${missingLocal}"');
      expect(result.error).toContain("must.declareConstants");
      expect(result.error).toContain('"${missingExport}"');
      expect(result.error).toContain("must.exportTypes");
    }
  });

  it("detects placeholders inside import and export aliases", () => {
    const conventions: ConventionV1[] = [
      {
        must: {
          exportTypes: [{ alias: "${missingTypeExport}", name: "SourceType" }],
          exportValues: [{ alias: "${missingExport}", name: "sourceValue" }],
          importTypes: [{ alias: "${missingTypeImport}", name: "SourceType" }],
          importValues: [{ alias: "${missingImport}", name: "sourceValue" }],
        },
        name: "aliases",
        paths: ["src/{x}"],
      },
    ];

    const result = validatePlaceholders({
      conventions,
      identifiers: ["aliases"],
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain('"${missingImport}"');
      expect(result.error).toContain('"${missingTypeImport}"');
      expect(result.error).toContain('"${missingExport}"');
      expect(result.error).toContain('"${missingTypeExport}"');
    }
  });

  it("detects a placeholder inside a nested MustBlock predicate", () => {
    const conventions: ConventionV1[] = [
      {
        must: [
          {
            if: { hasFile: "${missing}.ts" },
            must: { haveFiles: ["index.ts"] },
          },
        ],
        name: "block-form",
        paths: ["packages/{packageName}"],
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
        must: [
          {
            mustNot: { exportConstants: ["${missing}Debug"] },
          },
        ],
        name: "block-form",
        paths: ["packages/{packageName}"],
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
        must: { haveFiles: ["${packageName}/README.md"] },
        name: "single-path",
        paths: "packages/{packageName}",
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
        must: { haveFiles: ["${missing}.ts"] },
        paths: ["src/{x}"],
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
        must: { haveFiles: ["${missing}.ts"] },
        name: "manual",
        paths: ["src/{x}"],
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
        must: { haveFiles: ["${componentName}.tsx"] },
        name: "package-must-have-readme",
        paths: ["packages/{packageName}"],
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
        must: [
          {
            if: { placeholderSatisfies: "${missing}.matches(/foo/)" },
            must: { haveFiles: ["index.ts"] },
          },
        ],
        name: "satisfies",
        paths: ["packages/{packageName}"],
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

  it("reports placeholders inside import conditions", () => {
    const conventions: ConventionV1[] = [
      {
        must: [
          {
            if: { hasValueImport: "${missingValue}" },
            must: { haveType: "file" },
          },
          {
            if: {
              hasTypeImport: {
                from: "${missingTypeSource}",
                name: "${missingType}",
              },
            },
            must: { haveType: "file" },
          },
          {
            if: { hasValueImportFrom: "${missingValueSource}" },
            must: { haveType: "file" },
          },
          {
            if: { hasTypeImportFrom: "${missingTypeFromSource}" },
            must: { haveType: "file" },
          },
        ],
        name: "import-conditions",
        paths: ["packages/{packageName}/index.ts"],
      },
    ];

    const result = validatePlaceholders({
      conventions,
      identifiers: ["import-conditions"],
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain("must.if.hasValueImport");
      expect(result.error).toContain("must.if.hasTypeImport");
      expect(result.error).toContain("must.if.hasValueImportFrom");
      expect(result.error).toContain("must.if.hasTypeImportFrom");
    }
  });

  it("reports placeholders inside top-level and block ifNot conditions", () => {
    const conventions: ConventionV1[] = [
      {
        ifNot: { hasFile: "${missingTopLevel}.ts" },
        must: [
          {
            ifNot: { hasValueImportFrom: "${missingBlockSource}" },
            must: { haveType: "file" },
          },
        ],
        name: "negative-conditions",
        paths: ["packages/{packageName}/index.ts"],
      },
    ];

    const result = validatePlaceholders({
      conventions,
      identifiers: ["negative-conditions"],
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain("ifNot.hasFile");
      expect(result.error).toContain("must.ifNot.hasValueImportFrom");
    }
  });

  it("reports placeholders inside for.files (string and array form)", () => {
    const stringForm: ConventionV1[] = [
      {
        must: [
          {
            for: { files: "${missing}.ts" },
            must: { haveFiles: ["index.ts"] },
          },
        ],
        name: "for-string",
        paths: ["packages/{packageName}"],
      },
    ];
    const arrayForm: ConventionV1[] = [
      {
        must: [
          {
            for: { files: ["${missing}.ts"] },
            must: { haveFiles: ["index.ts"] },
          },
        ],
        name: "for-array",
        paths: ["packages/{packageName}"],
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
        must: {
          exportClasses: [
            {
              extend: { allowOmissions: true, type: "${missing}" },
              implement: ["${alsoMissing}"],
              name: "Foo",
            },
          ],
        },
        name: "classes",
        paths: ["src/{x}"],
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
        must: {
          declareClasses: [
            {
              implement: ["${missingImplement}"],
              name: "LocalClass",
            },
          ],
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
              extend: { allowOmissions: true, type: "${missingExtend}" },
              name: "Local",
            },
          ],
          declareTypes: [{ name: "${missingType}" }],
          useDeclarationOrder: ["${missingOrder}"],
        },
        name: "declarations",
        paths: ["src/{x}"],
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

  it("detects placeholders inside exact import source predicates", () => {
    const conventions: ConventionV1[] = [
      {
        must: {
          importValuesFrom: ["@scope/pkg", "@scope/${missingPackage}/*"],
        },
        name: "imports",
        paths: ["src/{x}"],
      },
    ];

    const result = validatePlaceholders({
      conventions,
      identifiers: ["imports"],
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain('"${missingPackage}"');
      expect(result.error).toContain("must.importValuesFrom");
    }
  });

  it("validates placeholders in both export source predicates and exclusions", () => {
    const conventions: ConventionV1[] = [
      {
        must: { exportValuesFrom: "@scope/${missingValue}" },
        mustNot: {
          exportTypesFrom: ["pkg/*", "!pkg/${missingType}/*"],
        },
        paths: "src/{x}",
      },
    ];
    const result = validatePlaceholders({
      conventions,
      identifiers: ["exports"],
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain("must.exportValuesFrom");
      expect(result.error).toContain("mustNot.exportTypesFrom");
    }
  });

  it("treats placeholders declared in for.files as in-scope for the block's predicates", () => {
    const conventions: ConventionV1[] = [
      {
        must: [
          {
            for: { files: "*/${providerId}-{modelKind:segments(2)}-model.ts" },
            must: {
              exportFunctions: ["create${providerId}${modelKind}"],
            },
          },
        ],
        name: "for-declares",
        paths: "packages/{providerId}",
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
        must: { haveFiles: ["${providerId}.ts"] },
        name: "constraint-paths",
        paths: "packages/{providerId:matches(^[a-z]+$)}",
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
        must: { exportValues: ["${providerId}"] },
        name: "static-providers",
        paths: "packages/openai/src/index.ts",
        placeholders: { providerId: "openai" },
      },
    ];

    const result = validatePlaceholders({
      conventions,
      identifiers: ["static-providers"],
    });

    expect(result.ok).toBe(true);
  });

  it("validates placeholders in callFunction names and arguments", () => {
    const conventions: ConventionV1[] = [
      {
        must: {
          callFunction: [
            {
              arguments: ["'${providerId}'"],
              name: "initialize${providerId}",
            },
          ],
        },
        name: "call-function",
        paths: "packages/{providerId}/src/index.ts",
      },
    ];

    expect(
      validatePlaceholders({
        conventions,
        identifiers: ["call-function"],
      })
    ).toEqual({ ok: true });

    const invalidResult = validatePlaceholders({
      conventions: [
        {
          ...conventions[0],
          must: {
            callFunction: [
              {
                arguments: ["'${missingArgument}'"],
                name: "initialize${missing}",
              },
            ],
          },
        },
      ],
      identifiers: ["call-function"],
    });

    expect(invalidResult.ok).toBe(false);
    if (!invalidResult.ok) {
      expect(invalidResult.error).toContain('"${missing}"');
      expect(invalidResult.error).toContain('"${missingArgument}"');
      expect(invalidResult.error).toContain("must.callFunction");
    }
  });

  it("rejects a name declared in both paths and placeholders", () => {
    const conventions: ConventionV1[] = [
      {
        must: { exportValues: ["${providerId}"] },
        name: "double-declared",
        paths: "packages/{providerId}/src/index.ts",
        placeholders: { providerId: "openai" },
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
        must: { haveFiles: ["index.ts"], haveType: "directory" },
        name: "static",
        paths: "src/lib",
      },
    ];

    const result = validatePlaceholders({
      conventions,
      identifiers: ["static"],
    });

    expect(result.ok).toBe(true);
  });
});
