import { describe, expect, it } from "vitest";
import {
  ReusableConventionsPackageV1Schema,
  ReusableConventionV1Schema,
} from "./index.js";

describe("ReusableConventionV1Schema", () => {
  it("accepts a minimal reusable convention", () => {
    const result = ReusableConventionV1Schema.safeParse({
      description: "Every package must have a README.md.",
      must: { haveFiles: ["README.md"] },
      name: "package-must-have-readme",
    });
    expect(result.success).toBe(true);
  });

  it("accepts optional paths, excludeFiles, severity, if, ifNot, for", () => {
    const result = ReusableConventionV1Schema.safeParse({
      description: "Component files must export default.",
      excludeFiles: ["**/*.test.ts"],
      for: { files: "${name}.ts" },
      if: { hasFile: "${name}.ts" },
      ifNot: { placeholderSatisfies: "name:segments(2)" },
      must: { exportValues: ["default"] },
      name: "files-must-export-default",
      paths: ["src/components/{name}.ts"],
      severity: "warning",
    });
    expect(result.success).toBe(true);
  });

  it("accepts mustNot without must", () => {
    const result = ReusableConventionV1Schema.safeParse({
      description: "Component files must not export debug helpers.",
      mustNot: { exportConstants: ["debug"] },
      name: "files-must-not-export-debug",
      paths: ["src/components/{name}.ts"],
    });
    expect(result.success).toBe(true);
  });

  it("accepts declaration, declaration order, and import source predicates", () => {
    const result = ReusableConventionV1Schema.safeParse({
      description: "Local declarations and import sources.",
      must: {
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
        exportTypes: [
          { from: "./public", name: "PublicType" },
          {
            name: "LocalExport",
            schema: { properties: {}, type: "object" },
          },
        ],
        importTypesFrom: ["react", "zod/*"],
        importTypesFromCurrentDir: true,
        importTypesFromExternals: true,
        importTypesFromParents: false,
        importValuesFrom: ["react", "zod/*"],
        importValuesFromCurrentDir: true,
        importValuesFromExternals: true,
        importValuesFromParents: false,
        useDeclarationOrder: ["localValue", "createLocal"],
      },
      name: "locals",
    });
    expect(result.success).toBe(true);
  });

  it("rejects invalid name pattern", () => {
    const result = ReusableConventionV1Schema.safeParse({
      description: "x",
      must: {},
      name: "Bad Name",
    });
    expect(result.success).toBe(false);
  });

  it("rejects MustBlock[] form (only object form allowed)", () => {
    const result = ReusableConventionV1Schema.safeParse({
      description: "x",
      must: [{ must: { haveType: "file" } }],
      name: "x",
    });
    expect(result.success).toBe(false);
  });

  it("rejects mustNot MustBlock[] form", () => {
    const result = ReusableConventionV1Schema.safeParse({
      description: "x",
      mustNot: [{ must: { haveType: "file" } }],
      name: "x",
    });
    expect(result.success).toBe(false);
  });

  it("rejects reusable conventions with neither must nor mustNot", () => {
    const result = ReusableConventionV1Schema.safeParse({
      description: "x",
      name: "x",
    });
    expect(result.success).toBe(false);
  });

  it("rejects missing description", () => {
    const result = ReusableConventionV1Schema.safeParse({
      must: {},
      name: "x",
    });
    expect(result.success).toBe(false);
  });
});

describe("ReusableConventionsPackageV1Schema", () => {
  it("accepts a valid package shape", () => {
    const result = ReusableConventionsPackageV1Schema.safeParse({
      conventionSpecVersion: "v1",
      conventions: [
        { description: "d", must: { haveFiles: ["README.md"] }, name: "a" },
      ],
    });
    expect(result.success).toBe(true);
  });

  it("accepts a package convention with mustNot", () => {
    const result = ReusableConventionsPackageV1Schema.safeParse({
      conventionSpecVersion: "v1",
      conventions: [
        {
          description: "d",
          mustNot: { exportValues: ["debug"] },
          name: "a",
        },
      ],
    });
    expect(result.success).toBe(true);
  });

  it("rejects wrong conventionSpecVersion", () => {
    const result = ReusableConventionsPackageV1Schema.safeParse({
      conventionSpecVersion: "v2",
      conventions: [],
    });
    expect(result.success).toBe(false);
  });

  it("rejects missing conventionSpecVersion", () => {
    const result = ReusableConventionsPackageV1Schema.safeParse({
      conventions: [],
    });
    expect(result.success).toBe(false);
  });
});
