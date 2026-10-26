import { describe, expect, it } from "vitest";
import {
  CallFunctionDefinitionV1Schema,
  ClassDefinitionV1Schema,
  ExportDefinitionV1Schema,
  FunctionDefinitionV1Schema,
  IfConditionV1Schema,
  ImportDefinitionV1Schema,
  InterfaceDefinitionV1Schema,
  MustBlockV1Schema,
  MustPredicatesV1Schema,
} from "./schemas.js";

describe("symbol definition schemas", () => {
  it("accepts source aliases for imports and exports", () => {
    expect(
      ExportDefinitionV1Schema.safeParse({
        alias: "publicValue",
        from: "./source",
        name: "sourceValue",
      }).success
    ).toBe(true);
    expect(
      ImportDefinitionV1Schema.safeParse({
        alias: "localValue",
        from: "package",
        name: "sourceValue",
      }).success
    ).toBe(true);
  });

  it("rejects unknown definition properties", () => {
    expect(
      ExportDefinitionV1Schema.safeParse({
        name: "sourceValue",
        unexpected: true,
      }).success
    ).toBe(false);
  });

  it("accepts function signatures and inheritance contracts", () => {
    expect(
      FunctionDefinitionV1Schema.safeParse({
        name: "createClient",
        receiveParamsOfTypes: ["ClientOptions"],
        returnValueOfType: "Client",
      }).success
    ).toBe(true);
    expect(
      InterfaceDefinitionV1Schema.safeParse({
        extend: { allowOmissions: true, type: "BaseClient" },
        name: "Client",
      }).success
    ).toBe(true);
    expect(
      ClassDefinitionV1Schema.safeParse({
        extend: "BaseClient",
        implement: ["Disposable", { allowOmissions: true, type: "Client" }],
        name: "ClientImpl",
      }).success
    ).toBe(true);
  });

  it("accepts call function definitions with expression arguments", () => {
    expect(
      CallFunctionDefinitionV1Schema.safeParse({
        arguments: ["'email'", "options"],
        name: "send",
      }).success
    ).toBe(true);
    expect(
      CallFunctionDefinitionV1Schema.safeParse({
        arguments: ["'email'", 1],
        name: "send",
      }).success
    ).toBe(false);
  });
});

describe("predicate and block schemas", () => {
  it.each([{}, { operator: "and" }, { operator: "or" }])(
    "accepts condition sets with options %j",
    (options) => {
      const condition = {
        conditions: [
          { hasFile: "index.ts" },
          { hasFile: "index.test.ts" },
          { hasDirectory: "tests" },
          { placeholderSatisfies: "name:segments(1)" },
          { hasValueImport: { from: "./client", name: "createClient" } },
          { hasValueImportFrom: "./client" },
          { hasTypeImport: "Client" },
          { hasTypeImportFrom: "./client" },
        ],
        ...options,
      };
      expect(IfConditionV1Schema.parse(condition)).toEqual(condition);
      expect(
        IfConditionV1Schema.safeParse({
          conditions: [{ hasFile: "index.ts" }],
          ...options,
        }).success
      ).toBe(true);
    }
  );

  it.each([
    {},
    { conditions: [] },
    { conditions: "index.ts" },
    { conditions: [{ conditions: [{ hasFile: "index.ts" }] }] },
    { conditions: [{ hasFile: "index.ts" }], operator: "xor" },
    { conditions: [{ hasFile: "index.ts" }], unexpected: true },
    { conditions: [{ hasFile: "index.ts" }], hasDirectory: "src" },
    { conditions: [{}] },
    { conditions: [{ unknown: "index.ts" }] },
    { conditions: [{ hasDirectory: "src", hasFile: "index.ts" }] },
    { conditions: [{ hasFile: "index.ts", operator: "or" }] },
    { conditions: [{ hasFile: ["index.ts"] }] },
    { conditions: [{ hasValueImport: { alias: "local", name: "source" } }] },
    { hasFile: "index.ts", operator: "and" },
    { operator: "or" },
    [{ hasFile: "index.ts" }],
  ])("rejects invalid condition set %j", (condition) => {
    expect(IfConditionV1Schema.safeParse(condition).success).toBe(false);
  });

  it.each([
    {
      condition: { hasValueImport: "createClient" },
      name: "value import string",
    },
    {
      condition: {
        hasValueImport: { from: "./client", name: "createClient" },
      },
      name: "value import object",
    },
    {
      condition: { hasValueImportFrom: "./client" },
      name: "value import source",
    },
    { condition: { hasTypeImport: "Client" }, name: "type import string" },
    {
      condition: { hasTypeImport: { from: "./client", name: "Client" } },
      name: "type import object",
    },
    {
      condition: { hasTypeImportFrom: "./client" },
      name: "type import source",
    },
  ])("accepts $name condition", ({ condition }) => {
    expect(IfConditionV1Schema.safeParse(condition).success).toBe(true);
  });

  it("rejects aliases and arrays in import conditions", () => {
    expect(
      IfConditionV1Schema.safeParse({
        hasValueImport: {
          alias: "createApiClient",
          name: "createClient",
        },
      }).success
    ).toBe(false);
    expect(
      IfConditionV1Schema.safeParse({
        hasTypeImport: ["Client"],
      }).success
    ).toBe(false);
  });

  it("accepts current predicates and valid import source selectors", () => {
    const result = MustPredicatesV1Schema.safeParse({
      areBarrelFiles: false,
      callFunction: ["initialize", { arguments: ["'email'"], name: "send" }],
      exportValues: ["createClient"],
      haveDirectories: ["instructions/*.{md,ts}"],
      haveFiles: ["index.ts"],
      haveType: "file",
      importTypesFromCurrentDir: true,
      importValuesFrom: ["@scope/*", "!@scope/internal"],
    });

    expect(result.success).toBe(true);
  });

  it("accepts directory conditions and requires directory predicate arrays", () => {
    expect(
      IfConditionV1Schema.safeParse({ hasDirectory: "src/*" }).success
    ).toBe(true);
    expect(
      IfConditionV1Schema.safeParse({ hasDirectory: ["src"] }).success
    ).toBe(false);
    expect(
      MustPredicatesV1Schema.safeParse({ haveDirectories: ["src"] }).success
    ).toBe(true);
    expect(
      MustPredicatesV1Schema.safeParse({ haveDirectories: "src" }).success
    ).toBe(false);
  });

  it("rejects invalid import source selector ordering", () => {
    const result = MustPredicatesV1Schema.safeParse({
      importValuesFrom: ["!@scope/internal", "@scope/*"],
    });

    expect(result.success).toBe(false);
  });

  it("accepts export source selectors and all export source location predicates", () => {
    expect(
      MustPredicatesV1Schema.safeParse({
        exportTypesFrom: "./types",
        exportTypesFromCurrentDir: false,
        exportTypesFromExternals: false,
        exportTypesFromParents: true,
        exportValuesFrom: ["pkg/*", "!pkg/private/*", "pkg/private/public/*"],
        exportValuesFromCurrentDir: true,
        exportValuesFromExternals: true,
        exportValuesFromParents: false,
      }).success
    ).toBe(true);
    const invalid = MustPredicatesV1Schema.safeParse({
      exportTypesFrom: ["!pkg/private/*", "pkg/*"],
    });
    expect(invalid.success).toBe(false);
    if (!invalid.success) {
      expect(invalid.error.issues[0]?.message).toContain(
        "export source pattern"
      );
    }
    expect(
      MustPredicatesV1Schema.safeParse({ exportFrom: "pkg" }).success
    ).toBe(false);
  });

  it("requires each block to provide must or mustNot predicates", () => {
    expect(
      MustBlockV1Schema.safeParse({
        for: { files: "index.ts" },
        if: { hasFile: "index.ts" },
        ifNot: { placeholderSatisfies: "name:segments(2)" },
        must: { exportValues: ["createClient"] },
        name: "required-export",
      }).success
    ).toBe(true);
    expect(
      MustBlockV1Schema.safeParse({
        mustNot: { exportValues: ["debug"] },
        name: "forbidden-export",
      }).success
    ).toBe(true);
    expect(MustBlockV1Schema.safeParse({ name: "empty" }).success).toBe(false);
  });
});
