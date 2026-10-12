import { describe, expect, it } from "vitest";
import { ConfigV1Schema, ConventionV1Schema } from "./schema.js";

describe("ConfigV1Schema", () => {
  it("accepts a minimal valid config with empty conventions", () => {
    const result = ConfigV1Schema.safeParse({
      conventions: [],
      version: "v1",
    });
    expect(result.success).toBe(true);
  });

  it("accepts a config with $schema field", () => {
    const result = ConfigV1Schema.safeParse({
      $schema: "https://example.com/schema.json",
      conventions: [],
      version: "v1",
    });
    expect(result.success).toBe(true);
  });

  it("accepts directory conditions and assertions in must blocks", () => {
    expect(
      ConfigV1Schema.safeParse({
        conventions: [
          {
            must: [
              {
                if: { hasDirectory: "instructions/*" },
                ifNot: { hasDirectory: "archive" },
                must: { haveDirectories: ["src", "docs/*"] },
                mustNot: { haveDirectories: ["secret/*"] },
              },
            ],
            paths: "modules/{module}",
          },
        ],
        version: "v1",
      }).success
    ).toBe(true);
  });

  it("accepts a condition on a top-level use reference", () => {
    const result = ConfigV1Schema.safeParse({
      conventions: [
        {
          if: { hasFile: "test.ts" },
          paths: "src/*.ts",
          use: "common/conditional-rule",
        },
      ],
      version: "v1",
    });

    expect(result.success).toBe(true);
  });

  it("accepts a negative condition on a top-level use reference", () => {
    const result = ConfigV1Schema.safeParse({
      conventions: [
        {
          ifNot: { hasFile: "test.ts" },
          paths: "src/*.ts",
          use: "common/conditional-rule",
        },
      ],
      version: "v1",
    });

    expect(result.success).toBe(true);
  });

  it("keeps top-level conditions unavailable to hand-written conventions", () => {
    for (const conditionField of ["if", "ifNot"]) {
      const result = ConfigV1Schema.safeParse({
        conventions: [
          {
            paths: "src/*.ts",
            [conditionField]: { hasFile: "test.ts" },
            must: { haveType: "file" },
          },
        ],
        version: "v1",
      });

      expect(result.success).toBe(false);
    }
  });

  it("accepts top-level conditions in the resolved convention schema", () => {
    const result = ConventionV1Schema.safeParse({
      if: { hasFile: "test.ts" },
      ifNot: { placeholderSatisfies: "name:segments(2)" },
      must: { haveType: "file" },
      paths: "src/*.ts",
    });

    expect(result.success).toBe(true);
  });

  it("accepts a convention with haveType predicate", () => {
    const result = ConfigV1Schema.safeParse({
      conventions: [
        {
          must: { haveType: "file" },
          name: "components-are-files",
          paths: "src/components/*.ts",
        },
      ],
      version: "v1",
    });
    expect(result.success).toBe(true);
  });

  it("accepts a convention with mustNot predicates and no must", () => {
    const result = ConfigV1Schema.safeParse({
      conventions: [
        {
          mustNot: { exportConstants: ["debug"] },
          paths: "src/components/*.ts",
        },
      ],
      version: "v1",
    });
    expect(result.success).toBe(true);
  });

  it("accepts a convention with both must and mustNot", () => {
    const result = ConfigV1Schema.safeParse({
      conventions: [
        {
          must: { haveType: "file" },
          mustNot: { exportConstants: ["debug"] },
          paths: "src/components/*.ts",
        },
      ],
      version: "v1",
    });
    expect(result.success).toBe(true);
  });

  it("accepts a convention with paths as array", () => {
    const result = ConfigV1Schema.safeParse({
      conventions: [
        {
          must: {},
          paths: ["src/*.ts", "lib/*.ts"],
        },
      ],
      version: "v1",
    });
    expect(result.success).toBe(true);
  });

  it("accepts a convention with all optional fields", () => {
    const result = ConfigV1Schema.safeParse({
      conventions: [
        {
          description: "A test rule",
          must: { haveType: "directory" },
          name: "my-rule",
          paths: "src/*.ts",
        },
      ],
      version: "v1",
    });
    expect(result.success).toBe(true);
  });

  it("accepts conventions with declaration predicates", () => {
    const result = ConfigV1Schema.safeParse({
      conventions: [
        {
          must: {
            callFunction: [
              "initialize",
              { arguments: ["'email'"], name: "send" },
            ],
            declareClasses: [
              {
                extend: "BaseClass",
                implement: ["Serializable"],
                name: "LocalClass",
              },
            ],
            declareConstants: ["localConstant"],
            declareFunctions: [
              {
                name: "createLocal",
                receiveParamOfType: "LocalConfig",
                receiveParamsOfTypes: ["LocalConfig"],
                returnValueOfType: "Local",
              },
            ],
            declareInterfaces: [{ extend: "BaseLocal", name: "Local" }],
            declareTypes: [
              {
                name: "LocalType",
                schema: { properties: {}, type: "object" },
              },
            ],
          },
          paths: "src/*.ts",
        },
      ],
      version: "v1",
    });
    expect(result.success).toBe(true);
  });

  it("rejects exportTypes entries with both from and schema", () => {
    const result = ConfigV1Schema.safeParse({
      conventions: [
        {
          must: {
            exportTypes: [
              {
                from: "./settings",
                name: "Settings",
                schema: { properties: {}, type: "object" },
              },
            ],
          },
          paths: "src/*.ts",
        },
      ],
      version: "v1",
    });
    expect(result.success).toBe(false);
  });

  it("accepts exact top-level type constraints", () => {
    const result = ConfigV1Schema.safeParse({
      conventions: [
        {
          must: {
            declareConstants: [
              { name: "localConstant", type: "SharedType<'local'>" },
            ],
            declareTypes: [{ name: "LocalType", type: "SharedType<'local'>" }],
            exportConstants: [
              { name: "publicConstant", type: "SharedType<'public'>" },
            ],
            exportTypes: [
              {
                alias: "AliasedType",
                name: "PublicType",
                type: "SharedType<'public'>",
              },
            ],
          },
          paths: "src/*.ts",
        },
      ],
      version: "v1",
    });
    expect(result.success).toBe(true);
  });

  it.each([
    { name: "Settings", schema: { type: "string" }, type: "SharedSettings" },
    { from: "./settings", name: "Settings", type: "SharedSettings" },
  ])("rejects conflicting exportTypes definition %#", (definition) => {
    const result = ConfigV1Schema.safeParse({
      conventions: [
        {
          must: { exportTypes: [definition] },
          paths: "src/*.ts",
        },
      ],
      version: "v1",
    });
    expect(result.success).toBe(false);
  });

  it("rejects from on exportConstants", () => {
    const result = ConfigV1Schema.safeParse({
      conventions: [
        {
          must: {
            exportConstants: [{ from: "./settings", name: "settings" }],
          },
          paths: "src/*.ts",
        },
      ],
      version: "v1",
    });
    expect(result.success).toBe(false);
  });

  it("accepts aliases for value and type import and export predicates", () => {
    const result = ConfigV1Schema.safeParse({
      conventions: [
        {
          must: {
            exportTypes: [
              {
                alias: "PublicType",
                name: "LocalType",
                schema: { properties: {}, type: "object" },
              },
              {
                alias: "PublicRemoteType",
                from: "./types",
                name: "RemoteType",
              },
            ],
            exportValues: [{ alias: "publicValue", name: "localValue" }],
            importTypes: [{ alias: "LocalType", name: "SourceType" }],
            importValues: [{ alias: "localValue", name: "sourceValue" }],
          },
          paths: "src/*.ts",
        },
      ],
      version: "v1",
    });
    expect(result.success).toBe(true);
  });

  it.each(["import", "export"])(
    "rejects aliases for the deprecated %s predicate",
    (predicate) => {
      const result = ConfigV1Schema.safeParse({
        conventions: [
          {
            must: {
              [predicate]: [{ alias: "publicName", name: "source" }],
            },
            paths: "src/*.ts",
          },
        ],
        version: "v1",
      });
      expect(result.success).toBe(false);
    }
  );

  it("rejects aliases for specialized export predicates", () => {
    const result = ConfigV1Schema.safeParse({
      conventions: [
        {
          must: {
            exportConstants: [{ alias: "publicName", name: "source" }],
          },
          paths: "src/*.ts",
        },
      ],
      version: "v1",
    });
    expect(result.success).toBe(false);
  });

  it("accepts conventions with declaration order and import source predicates", () => {
    const result = ConfigV1Schema.safeParse({
      conventions: [
        {
          must: {
            importTypesFrom: ["react", "zod/*"],
            importTypesFromCurrentDir: true,
            importTypesFromExternals: true,
            importTypesFromParents: false,
            importValuesFrom: ["react", "zod/*"],
            importValuesFromCurrentDir: true,
            importValuesFromExternals: true,
            importValuesFromParents: false,
            useDeclarationOrder: ["alpha", "beta"],
          },
          paths: "src/*.ts",
        },
      ],
      version: "v1",
    });
    expect(result.success).toBe(true);
  });

  it("rejects importValuesFrom when it is neither a string nor a string array", () => {
    const result = ConfigV1Schema.safeParse({
      conventions: [
        {
          must: { importValuesFrom: 123 },
          paths: "src/*.ts",
        },
      ],
      version: "v1",
    });
    expect(result.success).toBe(false);
  });

  it("rejects importTypesFrom arrays with non-string items", () => {
    const result = ConfigV1Schema.safeParse({
      conventions: [
        {
          must: { importTypesFrom: ["react", 123] },
          paths: "src/*.ts",
        },
      ],
      version: "v1",
    });
    expect(result.success).toBe(false);
  });

  it("accepts nested import source selectors", () => {
    const result = ConfigV1Schema.safeParse({
      conventions: [
        {
          must: {
            importValuesFrom: [
              "react",
              "@ai-sdk/*",
              "!@ai-sdk/harness/*",
              "@ai-sdk/harness/bridge",
            ],
          },
          mustNot: {
            importTypesFrom: [
              "@vendor/project/*",
              "!@vendor/project/internal/*",
              "@vendor/project/internal/public/*",
            ],
          },
          paths: "src/*.ts",
        },
      ],
      version: "v1",
    });

    expect(result.success).toBe(true);
  });

  it("rejects dangling import source exclusions", () => {
    const result = ConfigV1Schema.safeParse({
      conventions: [
        {
          must: {
            importValuesFrom: ["react", "!@ai-sdk/harness"],
          },
          paths: "src/*.ts",
        },
      ],
      version: "v1",
    });

    expect(result.success).toBe(false);
  });

  it("rejects redundant overlapping import source constraints", () => {
    const result = ConfigV1Schema.safeParse({
      conventions: [
        {
          mustNot: {
            importTypesFrom: ["@ai-sdk/react", "@ai-sdk/*"],
          },
          paths: "src/*.ts",
        },
      ],
      version: "v1",
    });

    expect(result.success).toBe(false);
  });

  it("rejects config with missing version", () => {
    const result = ConfigV1Schema.safeParse({
      conventions: [],
    });
    expect(result.success).toBe(false);
  });

  it("rejects config with wrong version", () => {
    const result = ConfigV1Schema.safeParse({
      conventions: [],
      version: "v2",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const versionIssue = result.error.issues.find((i) =>
        i.path.includes("version")
      );
      expect(versionIssue).toBeDefined();
    }
  });

  it("rejects config with wrong haveType value", () => {
    const result = ConfigV1Schema.safeParse({
      conventions: [
        {
          must: { haveType: "symlink" },
          paths: "src/*.ts",
        },
      ],
      version: "v1",
    });
    expect(result.success).toBe(false);
  });

  it("rejects convention with invalid name pattern", () => {
    const result = ConfigV1Schema.safeParse({
      conventions: [
        {
          must: {},
          name: "Invalid Name!",
          paths: "src/*.ts",
        },
      ],
      version: "v1",
    });
    expect(result.success).toBe(false);
  });

  it("rejects unknown predicates in must", () => {
    const result = ConfigV1Schema.safeParse({
      conventions: [
        {
          must: { unknownPredicate: ["foo"] },
          paths: "src/*.ts",
        },
      ],
      version: "v1",
    });
    expect(result.success).toBe(false);
  });

  it("rejects unknown predicates in mustNot", () => {
    const result = ConfigV1Schema.safeParse({
      conventions: [
        {
          mustNot: { unknownPredicate: ["foo"] },
          paths: "src/*.ts",
        },
      ],
      version: "v1",
    });
    expect(result.success).toBe(false);
  });

  it("accepts must as an array of MustBlocks", () => {
    const result = ConfigV1Schema.safeParse({
      conventions: [
        {
          must: [
            { must: { haveType: "file" } },
            { if: { hasFile: "index.ts" }, must: { haveType: "file" } },
          ],
          paths: "src/*.ts",
        },
      ],
      version: "v1",
    });
    expect(result.success).toBe(true);
  });

  it("rejects top-level mustNot as an array of MustBlocks", () => {
    const result = ConfigV1Schema.safeParse({
      conventions: [
        {
          mustNot: [{ must: { exportConstants: ["debug"] } }],
          paths: "src/*.ts",
        },
      ],
      version: "v1",
    });
    expect(result.success).toBe(false);
  });

  it("rejects top-level mustNot as a string reference", () => {
    const result = ConfigV1Schema.safeParse({
      conventions: [
        {
          mustNot: ["common/no-debug"],
          paths: "src/*.ts",
        },
      ],
      version: "v1",
    });
    expect(result.success).toBe(false);
  });

  it("rejects top-level mustNot as a use reference", () => {
    const result = ConfigV1Schema.safeParse({
      conventions: [
        {
          mustNot: [{ use: "common/no-debug" }],
          paths: "src/*.ts",
        },
      ],
      version: "v1",
    });
    expect(result.success).toBe(false);
  });

  it("accepts a MustBlock without if condition", () => {
    const result = ConfigV1Schema.safeParse({
      conventions: [
        {
          must: [{ must: { haveType: "file" } }],
          paths: "src/*.ts",
        },
      ],
      version: "v1",
    });
    expect(result.success).toBe(true);
  });

  it("accepts a MustBlock with for field", () => {
    const result = ConfigV1Schema.safeParse({
      conventions: [
        {
          must: [
            {
              for: { files: "{storyFile}.stories.tsx" },
              must: { exportConstants: ["meta"] },
            },
          ],
          paths: "components/{name}",
        },
      ],
      version: "v1",
    });
    expect(result.success).toBe(true);
  });

  it("accepts a MustBlock with if, ifNot, and for fields", () => {
    const result = ConfigV1Schema.safeParse({
      conventions: [
        {
          must: [
            {
              for: { files: "${name}.test.tsx" },
              if: { hasFile: "${name}.test.tsx" },
              ifNot: { placeholderSatisfies: "name:segments(2)" },
              must: { exportValues: ["describe"] },
            },
          ],
          paths: "components/{name}",
        },
      ],
      version: "v1",
    });
    expect(result.success).toBe(true);
  });

  it("accepts a MustBlock with if.placeholderSatisfies", () => {
    const result = ConfigV1Schema.safeParse({
      conventions: [
        {
          must: [
            {
              if: { placeholderSatisfies: "providerId:matches(^[a-z]+ai$)" },
              must: { haveType: "directory" },
            },
          ],
          paths: "packages/{providerId}",
        },
      ],
      version: "v1",
    });
    expect(result.success).toBe(true);
  });

  it.each([
    { hasValueImport: "createClient" },
    { hasValueImport: { from: "./client", name: "createClient" } },
    { hasValueImportFrom: "./client" },
    { hasTypeImport: "Client" },
    { hasTypeImport: { from: "./client", name: "Client" } },
    { hasTypeImportFrom: "./client" },
  ])(
    "accepts a MustBlock import condition through if and ifNot",
    (condition) => {
      for (const conditionField of ["if", "ifNot"]) {
        const result = ConfigV1Schema.safeParse({
          conventions: [
            {
              must: [
                {
                  [conditionField]: condition,
                  must: { haveType: "file" },
                },
              ],
              paths: "src/*.ts",
            },
          ],
          version: "v1",
        });
        expect(result.success).toBe(true);
      }
    }
  );

  it("rejects alias configuration in an import condition", () => {
    const result = ConfigV1Schema.safeParse({
      conventions: [
        {
          must: [
            {
              if: {
                hasValueImport: {
                  alias: "createApiClient",
                  name: "createClient",
                },
              },
              must: { haveType: "file" },
            },
          ],
          paths: "src/*.ts",
        },
      ],
      version: "v1",
    });
    expect(result.success).toBe(false);
  });

  it("rejects a MustBlock with if containing both hasFile and placeholderSatisfies", () => {
    const result = ConfigV1Schema.safeParse({
      conventions: [
        {
          must: [
            {
              if: {
                hasFile: "index.ts",
                placeholderSatisfies: "name:segments(1)",
              },
              must: { haveType: "file" },
            },
          ],
          paths: "packages/{name}",
        },
      ],
      version: "v1",
    });
    expect(result.success).toBe(false);
  });

  it("rejects a MustBlock with empty if object", () => {
    const result = ConfigV1Schema.safeParse({
      conventions: [
        {
          must: [{ if: {}, must: { haveType: "file" } }],
          paths: "src/*.ts",
        },
      ],
      version: "v1",
    });
    expect(result.success).toBe(false);
  });

  it("rejects a MustBlock with unknown if field", () => {
    const result = ConfigV1Schema.safeParse({
      conventions: [
        {
          must: [
            {
              if: { unknownCondition: "x" },
              must: { haveType: "file" },
            },
          ],
          paths: "src/*.ts",
        },
      ],
      version: "v1",
    });
    expect(result.success).toBe(false);
  });

  it("rejects a MustBlock array with neither must nor mustNot", () => {
    const result = ConfigV1Schema.safeParse({
      conventions: [
        {
          must: [{ if: { hasFile: "index.ts" } }],
          paths: "src/*.ts",
        },
      ],
      version: "v1",
    });
    expect(result.success).toBe(false);
  });

  it("accepts a MustBlock with only mustNot", () => {
    const result = ConfigV1Schema.safeParse({
      conventions: [
        {
          must: [
            {
              if: { hasFile: "index.ts" },
              mustNot: { exportValues: ["debug"] },
            },
          ],
          paths: "src/*.ts",
        },
      ],
      version: "v1",
    });
    expect(result.success).toBe(true);
  });

  it("accepts a convention with severity error", () => {
    const result = ConfigV1Schema.safeParse({
      conventions: [
        {
          must: { haveType: "file" },
          paths: "src/*.ts",
          severity: "error",
        },
      ],
      version: "v1",
    });
    expect(result.success).toBe(true);
  });

  it("accepts a convention with severity warning", () => {
    const result = ConfigV1Schema.safeParse({
      conventions: [
        {
          must: { haveType: "file" },
          paths: "src/*.ts",
          severity: "warning",
        },
      ],
      version: "v1",
    });
    expect(result.success).toBe(true);
  });

  it("accepts a convention without severity (defaults to error)", () => {
    const result = ConfigV1Schema.safeParse({
      conventions: [
        {
          must: { haveType: "file" },
          paths: "src/*.ts",
        },
      ],
      version: "v1",
    });
    expect(result.success).toBe(true);
  });

  it("rejects a convention with invalid severity value", () => {
    const result = ConfigV1Schema.safeParse({
      conventions: [
        {
          must: { haveType: "file" },
          paths: "src/*.ts",
          severity: "info",
        },
      ],
      version: "v1",
    });
    expect(result.success).toBe(false);
  });

  it("accepts a config with conventionSources", () => {
    const result = ConfigV1Schema.safeParse({
      conventionSources: {
        common: "./local-conventions.json",
        org: "@org/conventions",
      },
      conventions: [],
      version: "v1",
    });
    expect(result.success).toBe(true);
  });

  it("rejects conventionSources keys that don't match the prefix pattern", () => {
    const result = ConfigV1Schema.safeParse({
      conventionSources: {
        "Bad Prefix": "./x.json",
      },
      conventions: [],
      version: "v1",
    });
    expect(result.success).toBe(false);
  });

  it("rejects conventionSources values that are not strings", () => {
    const result = ConfigV1Schema.safeParse({
      conventionSources: {
        common: 123,
      },
      conventions: [],
      version: "v1",
    });
    expect(result.success).toBe(false);
  });

  it("accepts a bare-string entry in conventions[]", () => {
    const result = ConfigV1Schema.safeParse({
      conventionSources: { common: "./x.json" },
      conventions: ["common/some-convention"],
      version: "v1",
    });
    expect(result.success).toBe(true);
  });

  it("rejects bare-string entries that do not match vendor/name", () => {
    const result = ConfigV1Schema.safeParse({
      conventions: ["not-a-reference"],
      version: "v1",
    });
    expect(result.success).toBe(false);
  });

  it("rejects bare-string entries with uppercase characters", () => {
    const result = ConfigV1Schema.safeParse({
      conventions: ["Common/Foo"],
      version: "v1",
    });
    expect(result.success).toBe(false);
  });

  it("accepts a mix of bare strings and hand-written conventions", () => {
    const result = ConfigV1Schema.safeParse({
      conventionSources: { common: "./x.json" },
      conventions: [
        "common/foo",
        {
          must: { haveType: "file" },
          paths: "src/*.ts",
        },
      ],
      version: "v1",
    });
    expect(result.success).toBe(true);
  });

  it("accepts a use-form reference with paths override", () => {
    const result = ConfigV1Schema.safeParse({
      conventionSources: { common: "./x.json" },
      conventions: [
        {
          paths: ["src/components/{componentName}.ts"],
          use: "common/some-convention",
        },
      ],
      version: "v1",
    });
    expect(result.success).toBe(true);
  });

  it("accepts a use-form reference with no overrides", () => {
    const result = ConfigV1Schema.safeParse({
      conventionSources: { common: "./x.json" },
      conventions: [{ use: "common/some-convention" }],
      version: "v1",
    });
    expect(result.success).toBe(true);
  });

  it("accepts a use-form reference with severity, excludeFiles, and must overrides", () => {
    const result = ConfigV1Schema.safeParse({
      conventionSources: { common: "./x.json" },
      conventions: [
        {
          excludeFiles: ["src/skip.ts"],
          must: { haveType: "file" },
          severity: "warning",
          use: "common/some-convention",
        },
      ],
      version: "v1",
    });
    expect(result.success).toBe(true);
  });

  it("accepts a use-form reference with a mustNot override", () => {
    const result = ConfigV1Schema.safeParse({
      conventionSources: { common: "./x.json" },
      conventions: [
        {
          mustNot: { exportConstants: ["debug"] },
          use: "common/some-convention",
        },
      ],
      version: "v1",
    });
    expect(result.success).toBe(true);
  });

  it("rejects a use-form reference with a name field (strict)", () => {
    const result = ConfigV1Schema.safeParse({
      conventionSources: { common: "./x.json" },
      conventions: [
        {
          name: "renamed",
          use: "common/some-convention",
        },
      ],
      version: "v1",
    });
    expect(result.success).toBe(false);
  });

  it("rejects a use-form reference with a description field (strict)", () => {
    const result = ConfigV1Schema.safeParse({
      conventionSources: { common: "./x.json" },
      conventions: [
        {
          description: "rewritten",
          use: "common/some-convention",
        },
      ],
      version: "v1",
    });
    expect(result.success).toBe(false);
  });

  it("rejects a use-form reference with a single-segment use string", () => {
    const result = ConfigV1Schema.safeParse({
      conventions: [{ use: "common" }],
      version: "v1",
    });
    expect(result.success).toBe(false);
  });

  it("rejects a use-form reference with uppercase characters in use", () => {
    const result = ConfigV1Schema.safeParse({
      conventions: [{ use: "Common/Foo" }],
      version: "v1",
    });
    expect(result.success).toBe(false);
  });

  it("rejects a use-form reference with uppercase only in name segment", () => {
    const result = ConfigV1Schema.safeParse({
      conventions: [{ use: "common/Foo" }],
      version: "v1",
    });
    expect(result.success).toBe(false);
  });

  it("rejects a use-form reference with an unknown override field", () => {
    const result = ConfigV1Schema.safeParse({
      conventions: [
        {
          unknownField: "x",
          use: "common/some-convention",
        },
      ],
      version: "v1",
    });
    expect(result.success).toBe(false);
  });

  it("accepts a hand-written convention whose must[] contains a string reference", () => {
    const result = ConfigV1Schema.safeParse({
      conventionSources: { common: "./x.json" },
      conventions: [
        {
          must: [{ must: { haveType: "directory" } }, "common/some-must-block"],
          paths: "src/{name}",
        },
      ],
      version: "v1",
    });
    expect(result.success).toBe(true);
  });

  it("rejects a string reference inside must[] that does not match vendor/name", () => {
    const result = ConfigV1Schema.safeParse({
      conventions: [
        {
          must: ["not-a-reference"],
          paths: "src/{name}",
        },
      ],
      version: "v1",
    });
    expect(result.success).toBe(false);
  });

  it("accepts a hand-written convention whose must[] contains a use ref", () => {
    const result = ConfigV1Schema.safeParse({
      conventionSources: { common: "./x.json" },
      conventions: [
        {
          must: [
            { must: { haveType: "directory" } },
            { use: "common/some-must-block" },
          ],
          paths: "src/{name}",
        },
      ],
      version: "v1",
    });
    expect(result.success).toBe(true);
  });

  it("accepts a use ref inside must[] with override fields (if/for/excludeFiles/must)", () => {
    const result = ConfigV1Schema.safeParse({
      conventionSources: { common: "./x.json" },
      conventions: [
        {
          must: [
            {
              excludeFiles: ["${name}.skip.ts"],
              for: { files: "${name}.ts" },
              if: { hasFile: "${name}.ts" },
              must: { haveType: "file" },
              use: "common/some-must-block",
            },
          ],
          paths: "src/{name}",
        },
      ],
      version: "v1",
    });
    expect(result.success).toBe(true);
  });

  it("accepts a use ref inside must[] overriding name and description", () => {
    const result = ConfigV1Schema.safeParse({
      conventionSources: { common: "./x.json" },
      conventions: [
        {
          must: [
            {
              description: "Overridden description.",
              name: "renamed",
              use: "common/foo",
            },
          ],
          paths: "src/{name}",
        },
      ],
      version: "v1",
    });
    expect(result.success).toBe(true);
  });

  it("rejects a use ref inside must[] with an unknown override field (strict)", () => {
    const result = ConfigV1Schema.safeParse({
      conventionSources: { common: "./x.json" },
      conventions: [
        {
          must: [{ unknownField: "x", use: "common/foo" }],
          paths: "src/{name}",
        },
      ],
      version: "v1",
    });
    expect(result.success).toBe(false);
  });

  it("rejects a use ref inside must[] with paths or severity (top-level only)", () => {
    const withPaths = ConfigV1Schema.safeParse({
      conventionSources: { common: "./x.json" },
      conventions: [
        {
          must: [{ paths: "src/*.ts", use: "common/foo" }],
          paths: "src/{name}",
        },
      ],
      version: "v1",
    });
    expect(withPaths.success).toBe(false);

    const withSeverity = ConfigV1Schema.safeParse({
      conventionSources: { common: "./x.json" },
      conventions: [
        {
          must: [{ severity: "warning", use: "common/foo" }],
          paths: "src/{name}",
        },
      ],
      version: "v1",
    });
    expect(withSeverity.success).toBe(false);
  });

  it("rejects a use ref inside must[] with a malformed use string", () => {
    const result = ConfigV1Schema.safeParse({
      conventions: [
        {
          must: [{ use: "not-a-reference" }],
          paths: "src/{name}",
        },
      ],
      version: "v1",
    });
    expect(result.success).toBe(false);
  });

  it("accepts a convention with a placeholders map", () => {
    const result = ConfigV1Schema.safeParse({
      conventions: [
        {
          must: {},
          paths: "packages/openai/src/index.ts",
          placeholders: { providerId: "openai" },
        },
      ],
      version: "v1",
    });
    expect(result.success).toBe(true);
  });

  it("accepts placeholders on a use ref override", () => {
    const result = ConfigV1Schema.safeParse({
      conventionSources: { common: "./x.json" },
      conventions: [
        {
          paths: "packages/openai/src/index.ts",
          placeholders: { providerId: "openai" },
          use: "common/foo",
        },
      ],
      version: "v1",
    });
    expect(result.success).toBe(true);
  });

  it("rejects placeholders with an invalid name key", () => {
    const result = ConfigV1Schema.safeParse({
      conventions: [
        {
          must: {},
          paths: "src/index.ts",
          placeholders: { "1bad": "value" },
        },
      ],
      version: "v1",
    });
    expect(result.success).toBe(false);
  });

  it("rejects placeholders with an invalid value", () => {
    const result = ConfigV1Schema.safeParse({
      conventions: [
        {
          must: {},
          paths: "src/index.ts",
          placeholders: { name: "bad value" },
        },
      ],
      version: "v1",
    });
    expect(result.success).toBe(false);
  });

  it("rejects placeholders inside an inner must[] block", () => {
    const result = ConfigV1Schema.safeParse({
      conventions: [
        {
          must: [
            {
              must: {},
              placeholders: { name: "foo" },
            },
          ],
          paths: "src/{name}",
        },
      ],
      version: "v1",
    });
    expect(result.success).toBe(false);
  });
});
