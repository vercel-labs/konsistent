import { describe, expect, it } from "vitest";
import { ConfigV1Schema, ConventionV1Schema } from "./schema.js";

describe("ConfigV1Schema", () => {
  it("accepts a minimal valid config with empty conventions", () => {
    const result = ConfigV1Schema.safeParse({
      version: "v1",
      conventions: [],
    });
    expect(result.success).toBe(true);
  });

  it("accepts a config with $schema field", () => {
    const result = ConfigV1Schema.safeParse({
      $schema: "https://example.com/schema.json",
      version: "v1",
      conventions: [],
    });
    expect(result.success).toBe(true);
  });

  it("accepts a condition on a top-level use reference", () => {
    const result = ConfigV1Schema.safeParse({
      version: "v1",
      conventions: [
        {
          use: "common/conditional-rule",
          paths: "src/*.ts",
          if: { hasFile: "test.ts" },
        },
      ],
    });

    expect(result.success).toBe(true);
  });

  it("accepts a negative condition on a top-level use reference", () => {
    const result = ConfigV1Schema.safeParse({
      version: "v1",
      conventions: [
        {
          use: "common/conditional-rule",
          paths: "src/*.ts",
          ifNot: { hasFile: "test.ts" },
        },
      ],
    });

    expect(result.success).toBe(true);
  });

  it("keeps top-level conditions unavailable to hand-written conventions", () => {
    for (const conditionField of ["if", "ifNot"]) {
      const result = ConfigV1Schema.safeParse({
        version: "v1",
        conventions: [
          {
            paths: "src/*.ts",
            [conditionField]: { hasFile: "test.ts" },
            must: { haveType: "file" },
          },
        ],
      });

      expect(result.success).toBe(false);
    }
  });

  it("accepts top-level conditions in the resolved convention schema", () => {
    const result = ConventionV1Schema.safeParse({
      paths: "src/*.ts",
      if: { hasFile: "test.ts" },
      ifNot: { placeholderSatisfies: "name:segments(2)" },
      must: { haveType: "file" },
    });

    expect(result.success).toBe(true);
  });

  it("accepts a convention with haveType predicate", () => {
    const result = ConfigV1Schema.safeParse({
      version: "v1",
      conventions: [
        {
          name: "components-are-files",
          paths: "src/components/*.ts",
          must: { haveType: "file" },
        },
      ],
    });
    expect(result.success).toBe(true);
  });

  it("accepts a convention with mustNot predicates and no must", () => {
    const result = ConfigV1Schema.safeParse({
      version: "v1",
      conventions: [
        {
          paths: "src/components/*.ts",
          mustNot: { exportConstants: ["debug"] },
        },
      ],
    });
    expect(result.success).toBe(true);
  });

  it("accepts a convention with both must and mustNot", () => {
    const result = ConfigV1Schema.safeParse({
      version: "v1",
      conventions: [
        {
          paths: "src/components/*.ts",
          must: { haveType: "file" },
          mustNot: { exportConstants: ["debug"] },
        },
      ],
    });
    expect(result.success).toBe(true);
  });

  it("accepts a convention with paths as array", () => {
    const result = ConfigV1Schema.safeParse({
      version: "v1",
      conventions: [
        {
          paths: ["src/*.ts", "lib/*.ts"],
          must: {},
        },
      ],
    });
    expect(result.success).toBe(true);
  });

  it("accepts a convention with all optional fields", () => {
    const result = ConfigV1Schema.safeParse({
      version: "v1",
      conventions: [
        {
          name: "my-rule",
          description: "A test rule",
          paths: "src/*.ts",
          must: { haveType: "directory" },
        },
      ],
    });
    expect(result.success).toBe(true);
  });

  it("accepts conventions with declaration predicates", () => {
    const result = ConfigV1Schema.safeParse({
      version: "v1",
      conventions: [
        {
          paths: "src/*.ts",
          must: {
            declareTypes: [
              {
                name: "LocalType",
                schema: { type: "object", properties: {} },
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
            declareInterfaces: [{ name: "Local", extend: "BaseLocal" }],
            declareClasses: [
              {
                name: "LocalClass",
                extend: "BaseClass",
                implement: ["Serializable"],
              },
            ],
          },
        },
      ],
    });
    expect(result.success).toBe(true);
  });

  it("rejects exportTypes entries with both from and schema", () => {
    const result = ConfigV1Schema.safeParse({
      version: "v1",
      conventions: [
        {
          paths: "src/*.ts",
          must: {
            exportTypes: [
              {
                name: "Settings",
                from: "./settings",
                schema: { type: "object", properties: {} },
              },
            ],
          },
        },
      ],
    });
    expect(result.success).toBe(false);
  });

  it("accepts exact top-level type constraints", () => {
    const result = ConfigV1Schema.safeParse({
      version: "v1",
      conventions: [
        {
          paths: "src/*.ts",
          must: {
            declareTypes: [{ name: "LocalType", type: "SharedType<'local'>" }],
            declareConstants: [
              { name: "localConstant", type: "SharedType<'local'>" },
            ],
            exportTypes: [
              {
                name: "PublicType",
                alias: "AliasedType",
                type: "SharedType<'public'>",
              },
            ],
            exportConstants: [
              { name: "publicConstant", type: "SharedType<'public'>" },
            ],
          },
        },
      ],
    });
    expect(result.success).toBe(true);
  });

  it.each([
    { name: "Settings", schema: { type: "string" }, type: "SharedSettings" },
    { name: "Settings", from: "./settings", type: "SharedSettings" },
  ])("rejects conflicting exportTypes definition %#", (definition) => {
    const result = ConfigV1Schema.safeParse({
      version: "v1",
      conventions: [
        {
          paths: "src/*.ts",
          must: { exportTypes: [definition] },
        },
      ],
    });
    expect(result.success).toBe(false);
  });

  it("rejects from on exportConstants", () => {
    const result = ConfigV1Schema.safeParse({
      version: "v1",
      conventions: [
        {
          paths: "src/*.ts",
          must: {
            exportConstants: [{ name: "settings", from: "./settings" }],
          },
        },
      ],
    });
    expect(result.success).toBe(false);
  });

  it("accepts aliases for value and type import and export predicates", () => {
    const result = ConfigV1Schema.safeParse({
      version: "v1",
      conventions: [
        {
          paths: "src/*.ts",
          must: {
            importValues: [{ name: "sourceValue", alias: "localValue" }],
            importTypes: [{ name: "SourceType", alias: "LocalType" }],
            exportValues: [{ name: "localValue", alias: "publicValue" }],
            exportTypes: [
              {
                name: "LocalType",
                alias: "PublicType",
                schema: { type: "object", properties: {} },
              },
              {
                name: "RemoteType",
                alias: "PublicRemoteType",
                from: "./types",
              },
            ],
          },
        },
      ],
    });
    expect(result.success).toBe(true);
  });

  it.each([
    "import",
    "export",
  ])("rejects aliases for the deprecated %s predicate", (predicate) => {
    const result = ConfigV1Schema.safeParse({
      version: "v1",
      conventions: [
        {
          paths: "src/*.ts",
          must: {
            [predicate]: [{ name: "source", alias: "publicName" }],
          },
        },
      ],
    });
    expect(result.success).toBe(false);
  });

  it("rejects aliases for specialized export predicates", () => {
    const result = ConfigV1Schema.safeParse({
      version: "v1",
      conventions: [
        {
          paths: "src/*.ts",
          must: {
            exportConstants: [{ name: "source", alias: "publicName" }],
          },
        },
      ],
    });
    expect(result.success).toBe(false);
  });

  it("accepts conventions with declaration order and import source predicates", () => {
    const result = ConfigV1Schema.safeParse({
      version: "v1",
      conventions: [
        {
          paths: "src/*.ts",
          must: {
            useDeclarationOrder: ["alpha", "beta"],
            importValuesFrom: ["react", "zod/*"],
            importTypesFrom: ["react", "zod/*"],
            importValuesFromCurrentDir: true,
            importValuesFromParents: false,
            importValuesFromExternals: true,
            importTypesFromCurrentDir: true,
            importTypesFromParents: false,
            importTypesFromExternals: true,
          },
        },
      ],
    });
    expect(result.success).toBe(true);
  });

  it("rejects importValuesFrom when it is neither a string nor a string array", () => {
    const result = ConfigV1Schema.safeParse({
      version: "v1",
      conventions: [
        {
          paths: "src/*.ts",
          must: { importValuesFrom: 123 },
        },
      ],
    });
    expect(result.success).toBe(false);
  });

  it("rejects importTypesFrom arrays with non-string items", () => {
    const result = ConfigV1Schema.safeParse({
      version: "v1",
      conventions: [
        {
          paths: "src/*.ts",
          must: { importTypesFrom: ["react", 123] },
        },
      ],
    });
    expect(result.success).toBe(false);
  });

  it("accepts nested import source selectors", () => {
    const result = ConfigV1Schema.safeParse({
      version: "v1",
      conventions: [
        {
          paths: "src/*.ts",
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
        },
      ],
    });

    expect(result.success).toBe(true);
  });

  it("rejects dangling import source exclusions", () => {
    const result = ConfigV1Schema.safeParse({
      version: "v1",
      conventions: [
        {
          paths: "src/*.ts",
          must: {
            importValuesFrom: ["react", "!@ai-sdk/harness"],
          },
        },
      ],
    });

    expect(result.success).toBe(false);
  });

  it("rejects redundant overlapping import source constraints", () => {
    const result = ConfigV1Schema.safeParse({
      version: "v1",
      conventions: [
        {
          paths: "src/*.ts",
          mustNot: {
            importTypesFrom: ["@ai-sdk/react", "@ai-sdk/*"],
          },
        },
      ],
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
      version: "v2",
      conventions: [],
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
      version: "v1",
      conventions: [
        {
          paths: "src/*.ts",
          must: { haveType: "symlink" },
        },
      ],
    });
    expect(result.success).toBe(false);
  });

  it("rejects convention with invalid name pattern", () => {
    const result = ConfigV1Schema.safeParse({
      version: "v1",
      conventions: [
        {
          name: "Invalid Name!",
          paths: "src/*.ts",
          must: {},
        },
      ],
    });
    expect(result.success).toBe(false);
  });

  it("rejects unknown predicates in must", () => {
    const result = ConfigV1Schema.safeParse({
      version: "v1",
      conventions: [
        {
          paths: "src/*.ts",
          must: { unknownPredicate: ["foo"] },
        },
      ],
    });
    expect(result.success).toBe(false);
  });

  it("rejects unknown predicates in mustNot", () => {
    const result = ConfigV1Schema.safeParse({
      version: "v1",
      conventions: [
        {
          paths: "src/*.ts",
          mustNot: { unknownPredicate: ["foo"] },
        },
      ],
    });
    expect(result.success).toBe(false);
  });

  it("accepts must as an array of MustBlocks", () => {
    const result = ConfigV1Schema.safeParse({
      version: "v1",
      conventions: [
        {
          paths: "src/*.ts",
          must: [
            { must: { haveType: "file" } },
            { if: { hasFile: "index.ts" }, must: { haveType: "file" } },
          ],
        },
      ],
    });
    expect(result.success).toBe(true);
  });

  it("rejects top-level mustNot as an array of MustBlocks", () => {
    const result = ConfigV1Schema.safeParse({
      version: "v1",
      conventions: [
        {
          paths: "src/*.ts",
          mustNot: [{ must: { exportConstants: ["debug"] } }],
        },
      ],
    });
    expect(result.success).toBe(false);
  });

  it("rejects top-level mustNot as a string reference", () => {
    const result = ConfigV1Schema.safeParse({
      version: "v1",
      conventions: [
        {
          paths: "src/*.ts",
          mustNot: ["common/no-debug"],
        },
      ],
    });
    expect(result.success).toBe(false);
  });

  it("rejects top-level mustNot as a use reference", () => {
    const result = ConfigV1Schema.safeParse({
      version: "v1",
      conventions: [
        {
          paths: "src/*.ts",
          mustNot: [{ use: "common/no-debug" }],
        },
      ],
    });
    expect(result.success).toBe(false);
  });

  it("accepts a MustBlock without if condition", () => {
    const result = ConfigV1Schema.safeParse({
      version: "v1",
      conventions: [
        {
          paths: "src/*.ts",
          must: [{ must: { haveType: "file" } }],
        },
      ],
    });
    expect(result.success).toBe(true);
  });

  it("accepts a MustBlock with for field", () => {
    const result = ConfigV1Schema.safeParse({
      version: "v1",
      conventions: [
        {
          paths: "components/{name}",
          must: [
            {
              for: { files: "{storyFile}.stories.tsx" },
              must: { exportConstants: ["meta"] },
            },
          ],
        },
      ],
    });
    expect(result.success).toBe(true);
  });

  it("accepts a MustBlock with if, ifNot, and for fields", () => {
    const result = ConfigV1Schema.safeParse({
      version: "v1",
      conventions: [
        {
          paths: "components/{name}",
          must: [
            {
              if: { hasFile: "${name}.test.tsx" },
              ifNot: { placeholderSatisfies: "name:segments(2)" },
              for: { files: "${name}.test.tsx" },
              must: { exportValues: ["describe"] },
            },
          ],
        },
      ],
    });
    expect(result.success).toBe(true);
  });

  it("accepts a MustBlock with if.placeholderSatisfies", () => {
    const result = ConfigV1Schema.safeParse({
      version: "v1",
      conventions: [
        {
          paths: "packages/{providerId}",
          must: [
            {
              if: { placeholderSatisfies: "providerId:matches(^[a-z]+ai$)" },
              must: { haveType: "directory" },
            },
          ],
        },
      ],
    });
    expect(result.success).toBe(true);
  });

  it.each([
    { hasValueImport: "createClient" },
    { hasValueImport: { name: "createClient", from: "./client" } },
    { hasValueImportFrom: "./client" },
    { hasTypeImport: "Client" },
    { hasTypeImport: { name: "Client", from: "./client" } },
    { hasTypeImportFrom: "./client" },
  ])("accepts a MustBlock import condition through if and ifNot", (condition) => {
    for (const conditionField of ["if", "ifNot"]) {
      const result = ConfigV1Schema.safeParse({
        version: "v1",
        conventions: [
          {
            paths: "src/*.ts",
            must: [
              {
                [conditionField]: condition,
                must: { haveType: "file" },
              },
            ],
          },
        ],
      });
      expect(result.success).toBe(true);
    }
  });

  it("rejects alias configuration in an import condition", () => {
    const result = ConfigV1Schema.safeParse({
      version: "v1",
      conventions: [
        {
          paths: "src/*.ts",
          must: [
            {
              if: {
                hasValueImport: {
                  name: "createClient",
                  alias: "createApiClient",
                },
              },
              must: { haveType: "file" },
            },
          ],
        },
      ],
    });
    expect(result.success).toBe(false);
  });

  it("rejects a MustBlock with if containing both hasFile and placeholderSatisfies", () => {
    const result = ConfigV1Schema.safeParse({
      version: "v1",
      conventions: [
        {
          paths: "packages/{name}",
          must: [
            {
              if: {
                hasFile: "index.ts",
                placeholderSatisfies: "name:segments(1)",
              },
              must: { haveType: "file" },
            },
          ],
        },
      ],
    });
    expect(result.success).toBe(false);
  });

  it("rejects a MustBlock with empty if object", () => {
    const result = ConfigV1Schema.safeParse({
      version: "v1",
      conventions: [
        {
          paths: "src/*.ts",
          must: [{ if: {}, must: { haveType: "file" } }],
        },
      ],
    });
    expect(result.success).toBe(false);
  });

  it("rejects a MustBlock with unknown if field", () => {
    const result = ConfigV1Schema.safeParse({
      version: "v1",
      conventions: [
        {
          paths: "src/*.ts",
          must: [
            {
              if: { unknownCondition: "x" },
              must: { haveType: "file" },
            },
          ],
        },
      ],
    });
    expect(result.success).toBe(false);
  });

  it("rejects a MustBlock array with neither must nor mustNot", () => {
    const result = ConfigV1Schema.safeParse({
      version: "v1",
      conventions: [
        {
          paths: "src/*.ts",
          must: [{ if: { hasFile: "index.ts" } }],
        },
      ],
    });
    expect(result.success).toBe(false);
  });

  it("accepts a MustBlock with only mustNot", () => {
    const result = ConfigV1Schema.safeParse({
      version: "v1",
      conventions: [
        {
          paths: "src/*.ts",
          must: [
            {
              if: { hasFile: "index.ts" },
              mustNot: { exportValues: ["debug"] },
            },
          ],
        },
      ],
    });
    expect(result.success).toBe(true);
  });

  it("accepts a convention with severity error", () => {
    const result = ConfigV1Schema.safeParse({
      version: "v1",
      conventions: [
        {
          paths: "src/*.ts",
          severity: "error",
          must: { haveType: "file" },
        },
      ],
    });
    expect(result.success).toBe(true);
  });

  it("accepts a convention with severity warning", () => {
    const result = ConfigV1Schema.safeParse({
      version: "v1",
      conventions: [
        {
          paths: "src/*.ts",
          severity: "warning",
          must: { haveType: "file" },
        },
      ],
    });
    expect(result.success).toBe(true);
  });

  it("accepts a convention without severity (defaults to error)", () => {
    const result = ConfigV1Schema.safeParse({
      version: "v1",
      conventions: [
        {
          paths: "src/*.ts",
          must: { haveType: "file" },
        },
      ],
    });
    expect(result.success).toBe(true);
  });

  it("rejects a convention with invalid severity value", () => {
    const result = ConfigV1Schema.safeParse({
      version: "v1",
      conventions: [
        {
          paths: "src/*.ts",
          severity: "info",
          must: { haveType: "file" },
        },
      ],
    });
    expect(result.success).toBe(false);
  });

  it("accepts a config with conventionSources", () => {
    const result = ConfigV1Schema.safeParse({
      version: "v1",
      conventionSources: {
        common: "./local-conventions.json",
        org: "@org/conventions",
      },
      conventions: [],
    });
    expect(result.success).toBe(true);
  });

  it("rejects conventionSources keys that don't match the prefix pattern", () => {
    const result = ConfigV1Schema.safeParse({
      version: "v1",
      conventionSources: {
        "Bad Prefix": "./x.json",
      },
      conventions: [],
    });
    expect(result.success).toBe(false);
  });

  it("rejects conventionSources values that are not strings", () => {
    const result = ConfigV1Schema.safeParse({
      version: "v1",
      conventionSources: {
        common: 123,
      },
      conventions: [],
    });
    expect(result.success).toBe(false);
  });

  it("accepts a bare-string entry in conventions[]", () => {
    const result = ConfigV1Schema.safeParse({
      version: "v1",
      conventionSources: { common: "./x.json" },
      conventions: ["common/some-convention"],
    });
    expect(result.success).toBe(true);
  });

  it("rejects bare-string entries that do not match vendor/name", () => {
    const result = ConfigV1Schema.safeParse({
      version: "v1",
      conventions: ["not-a-reference"],
    });
    expect(result.success).toBe(false);
  });

  it("rejects bare-string entries with uppercase characters", () => {
    const result = ConfigV1Schema.safeParse({
      version: "v1",
      conventions: ["Common/Foo"],
    });
    expect(result.success).toBe(false);
  });

  it("accepts a mix of bare strings and hand-written conventions", () => {
    const result = ConfigV1Schema.safeParse({
      version: "v1",
      conventionSources: { common: "./x.json" },
      conventions: [
        "common/foo",
        {
          paths: "src/*.ts",
          must: { haveType: "file" },
        },
      ],
    });
    expect(result.success).toBe(true);
  });

  it("accepts a use-form reference with paths override", () => {
    const result = ConfigV1Schema.safeParse({
      version: "v1",
      conventionSources: { common: "./x.json" },
      conventions: [
        {
          use: "common/some-convention",
          paths: ["src/components/{componentName}.ts"],
        },
      ],
    });
    expect(result.success).toBe(true);
  });

  it("accepts a use-form reference with no overrides", () => {
    const result = ConfigV1Schema.safeParse({
      version: "v1",
      conventionSources: { common: "./x.json" },
      conventions: [{ use: "common/some-convention" }],
    });
    expect(result.success).toBe(true);
  });

  it("accepts a use-form reference with severity, excludeFiles, and must overrides", () => {
    const result = ConfigV1Schema.safeParse({
      version: "v1",
      conventionSources: { common: "./x.json" },
      conventions: [
        {
          use: "common/some-convention",
          severity: "warning",
          excludeFiles: ["src/skip.ts"],
          must: { haveType: "file" },
        },
      ],
    });
    expect(result.success).toBe(true);
  });

  it("accepts a use-form reference with a mustNot override", () => {
    const result = ConfigV1Schema.safeParse({
      version: "v1",
      conventionSources: { common: "./x.json" },
      conventions: [
        {
          use: "common/some-convention",
          mustNot: { exportConstants: ["debug"] },
        },
      ],
    });
    expect(result.success).toBe(true);
  });

  it("rejects a use-form reference with a name field (strict)", () => {
    const result = ConfigV1Schema.safeParse({
      version: "v1",
      conventionSources: { common: "./x.json" },
      conventions: [
        {
          use: "common/some-convention",
          name: "renamed",
        },
      ],
    });
    expect(result.success).toBe(false);
  });

  it("rejects a use-form reference with a description field (strict)", () => {
    const result = ConfigV1Schema.safeParse({
      version: "v1",
      conventionSources: { common: "./x.json" },
      conventions: [
        {
          use: "common/some-convention",
          description: "rewritten",
        },
      ],
    });
    expect(result.success).toBe(false);
  });

  it("rejects a use-form reference with a single-segment use string", () => {
    const result = ConfigV1Schema.safeParse({
      version: "v1",
      conventions: [{ use: "common" }],
    });
    expect(result.success).toBe(false);
  });

  it("rejects a use-form reference with uppercase characters in use", () => {
    const result = ConfigV1Schema.safeParse({
      version: "v1",
      conventions: [{ use: "Common/Foo" }],
    });
    expect(result.success).toBe(false);
  });

  it("rejects a use-form reference with uppercase only in name segment", () => {
    const result = ConfigV1Schema.safeParse({
      version: "v1",
      conventions: [{ use: "common/Foo" }],
    });
    expect(result.success).toBe(false);
  });

  it("rejects a use-form reference with an unknown override field", () => {
    const result = ConfigV1Schema.safeParse({
      version: "v1",
      conventions: [
        {
          use: "common/some-convention",
          unknownField: "x",
        },
      ],
    });
    expect(result.success).toBe(false);
  });

  it("accepts a hand-written convention whose must[] contains a string reference", () => {
    const result = ConfigV1Schema.safeParse({
      version: "v1",
      conventionSources: { common: "./x.json" },
      conventions: [
        {
          paths: "src/{name}",
          must: [{ must: { haveType: "directory" } }, "common/some-must-block"],
        },
      ],
    });
    expect(result.success).toBe(true);
  });

  it("rejects a string reference inside must[] that does not match vendor/name", () => {
    const result = ConfigV1Schema.safeParse({
      version: "v1",
      conventions: [
        {
          paths: "src/{name}",
          must: ["not-a-reference"],
        },
      ],
    });
    expect(result.success).toBe(false);
  });

  it("accepts a hand-written convention whose must[] contains a use ref", () => {
    const result = ConfigV1Schema.safeParse({
      version: "v1",
      conventionSources: { common: "./x.json" },
      conventions: [
        {
          paths: "src/{name}",
          must: [
            { must: { haveType: "directory" } },
            { use: "common/some-must-block" },
          ],
        },
      ],
    });
    expect(result.success).toBe(true);
  });

  it("accepts a use ref inside must[] with override fields (if/for/excludeFiles/must)", () => {
    const result = ConfigV1Schema.safeParse({
      version: "v1",
      conventionSources: { common: "./x.json" },
      conventions: [
        {
          paths: "src/{name}",
          must: [
            {
              use: "common/some-must-block",
              if: { hasFile: "${name}.ts" },
              for: { files: "${name}.ts" },
              excludeFiles: ["${name}.skip.ts"],
              must: { haveType: "file" },
            },
          ],
        },
      ],
    });
    expect(result.success).toBe(true);
  });

  it("accepts a use ref inside must[] overriding name and description", () => {
    const result = ConfigV1Schema.safeParse({
      version: "v1",
      conventionSources: { common: "./x.json" },
      conventions: [
        {
          paths: "src/{name}",
          must: [
            {
              use: "common/foo",
              name: "renamed",
              description: "Overridden description.",
            },
          ],
        },
      ],
    });
    expect(result.success).toBe(true);
  });

  it("rejects a use ref inside must[] with an unknown override field (strict)", () => {
    const result = ConfigV1Schema.safeParse({
      version: "v1",
      conventionSources: { common: "./x.json" },
      conventions: [
        {
          paths: "src/{name}",
          must: [{ use: "common/foo", unknownField: "x" }],
        },
      ],
    });
    expect(result.success).toBe(false);
  });

  it("rejects a use ref inside must[] with paths or severity (top-level only)", () => {
    const withPaths = ConfigV1Schema.safeParse({
      version: "v1",
      conventionSources: { common: "./x.json" },
      conventions: [
        {
          paths: "src/{name}",
          must: [{ use: "common/foo", paths: "src/*.ts" }],
        },
      ],
    });
    expect(withPaths.success).toBe(false);

    const withSeverity = ConfigV1Schema.safeParse({
      version: "v1",
      conventionSources: { common: "./x.json" },
      conventions: [
        {
          paths: "src/{name}",
          must: [{ use: "common/foo", severity: "warning" }],
        },
      ],
    });
    expect(withSeverity.success).toBe(false);
  });

  it("rejects a use ref inside must[] with a malformed use string", () => {
    const result = ConfigV1Schema.safeParse({
      version: "v1",
      conventions: [
        {
          paths: "src/{name}",
          must: [{ use: "not-a-reference" }],
        },
      ],
    });
    expect(result.success).toBe(false);
  });

  it("accepts a convention with a placeholders map", () => {
    const result = ConfigV1Schema.safeParse({
      version: "v1",
      conventions: [
        {
          paths: "packages/openai/src/index.ts",
          placeholders: { providerId: "openai" },
          must: {},
        },
      ],
    });
    expect(result.success).toBe(true);
  });

  it("accepts placeholders on a use ref override", () => {
    const result = ConfigV1Schema.safeParse({
      version: "v1",
      conventionSources: { common: "./x.json" },
      conventions: [
        {
          use: "common/foo",
          paths: "packages/openai/src/index.ts",
          placeholders: { providerId: "openai" },
        },
      ],
    });
    expect(result.success).toBe(true);
  });

  it("rejects placeholders with an invalid name key", () => {
    const result = ConfigV1Schema.safeParse({
      version: "v1",
      conventions: [
        {
          paths: "src/index.ts",
          placeholders: { "1bad": "value" },
          must: {},
        },
      ],
    });
    expect(result.success).toBe(false);
  });

  it("rejects placeholders with an invalid value", () => {
    const result = ConfigV1Schema.safeParse({
      version: "v1",
      conventions: [
        {
          paths: "src/index.ts",
          placeholders: { name: "bad value" },
          must: {},
        },
      ],
    });
    expect(result.success).toBe(false);
  });

  it("rejects placeholders inside an inner must[] block", () => {
    const result = ConfigV1Schema.safeParse({
      version: "v1",
      conventions: [
        {
          paths: "src/{name}",
          must: [
            {
              placeholders: { name: "foo" },
              must: {},
            },
          ],
        },
      ],
    });
    expect(result.success).toBe(false);
  });
});
