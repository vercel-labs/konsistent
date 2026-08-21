import { describe, expect, it } from "vitest";
import {
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
        name: "sourceValue",
        alias: "publicValue",
        from: "./source",
      }).success
    ).toBe(true);
    expect(
      ImportDefinitionV1Schema.safeParse({
        name: "sourceValue",
        alias: "localValue",
        from: "package",
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
        name: "Client",
        extend: { type: "BaseClient", allowOmissions: true },
      }).success
    ).toBe(true);
    expect(
      ClassDefinitionV1Schema.safeParse({
        name: "ClientImpl",
        extend: "BaseClient",
        implement: ["Disposable", { type: "Client", allowOmissions: true }],
      }).success
    ).toBe(true);
  });
});

describe("predicate and block schemas", () => {
  it.each([
    {
      name: "value import string",
      condition: { hasValueImport: "createClient" },
    },
    {
      name: "value import object",
      condition: {
        hasValueImport: { name: "createClient", from: "./client" },
      },
    },
    {
      name: "value import source",
      condition: { hasValueImportFrom: "./client" },
    },
    { name: "type import string", condition: { hasTypeImport: "Client" } },
    {
      name: "type import object",
      condition: { hasTypeImport: { name: "Client", from: "./client" } },
    },
    {
      name: "type import source",
      condition: { hasTypeImportFrom: "./client" },
    },
  ])("accepts $name condition", ({ condition }) => {
    expect(IfConditionV1Schema.safeParse(condition).success).toBe(true);
  });

  it("rejects aliases and arrays in import conditions", () => {
    expect(
      IfConditionV1Schema.safeParse({
        hasValueImport: {
          name: "createClient",
          alias: "createApiClient",
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
      haveType: "file",
      haveFiles: ["index.ts"],
      exportValues: ["createClient"],
      importValuesFrom: ["@scope/*", "!@scope/internal"],
      importTypesFromCurrentDir: true,
      areBarrelFiles: false,
    });

    expect(result.success).toBe(true);
  });

  it("rejects invalid import source selector ordering", () => {
    const result = MustPredicatesV1Schema.safeParse({
      importValuesFrom: ["!@scope/internal", "@scope/*"],
    });

    expect(result.success).toBe(false);
  });

  it("requires each block to provide must or mustNot predicates", () => {
    expect(
      MustBlockV1Schema.safeParse({
        name: "required-export",
        if: { hasFile: "index.ts" },
        ifNot: { placeholderSatisfies: "name:segments(2)" },
        for: { files: "index.ts" },
        must: { exportValues: ["createClient"] },
      }).success
    ).toBe(true);
    expect(
      MustBlockV1Schema.safeParse({
        name: "forbidden-export",
        mustNot: { exportValues: ["debug"] },
      }).success
    ).toBe(true);
    expect(MustBlockV1Schema.safeParse({ name: "empty" }).success).toBe(false);
  });
});
