import { describe, expect, expectTypeOf, it } from "vitest";
import type { ReusableConventionV1 } from "./index.js";
import {
  defineConventions,
  ReusableConventionsPackageV1Schema,
  ReusableConventionV1Schema,
} from "./index.js";

describe("ReusableConventionV1Schema", () => {
  it("accepts a minimal reusable convention", () => {
    const result = ReusableConventionV1Schema.safeParse({
      name: "package-must-have-readme",
      description: "Every package must have a README.md.",
      must: { haveFiles: ["README.md"] },
    });
    expect(result.success).toBe(true);
  });

  it("accepts optional paths, excludeFiles, severity, if, for", () => {
    const result = ReusableConventionV1Schema.safeParse({
      name: "files-must-export-default",
      description: "Component files must export default.",
      paths: ["src/components/{name}.ts"],
      excludeFiles: ["**/*.test.ts"],
      severity: "warning",
      if: { hasFile: "${name}.ts" },
      for: { files: "${name}.ts" },
      must: { export: ["default"] },
    });
    expect(result.success).toBe(true);
  });

  it("accepts mustNot without must", () => {
    const result = ReusableConventionV1Schema.safeParse({
      name: "files-must-not-export-debug",
      description: "Component files must not export debug helpers.",
      paths: ["src/components/{name}.ts"],
      mustNot: { exportConstants: ["debug"] },
    });
    expect(result.success).toBe(true);
  });

  it("accepts declaration, declaration order, and import source predicates", () => {
    const result = ReusableConventionV1Schema.safeParse({
      name: "locals",
      description: "Local declarations and import sources.",
      must: {
        declareTypes: [{ name: "LocalType" }],
        declareConstants: ["localConstant"],
        declareFunctions: [
          {
            name: "createLocal",
            receiveParamOfType: "LocalConfig",
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
        useDeclarationOrder: ["localValue", "createLocal"],
        importFromCurrentDir: true,
        importFromParents: false,
        importFromExternals: true,
      },
    });
    expect(result.success).toBe(true);
  });

  it("rejects invalid name pattern", () => {
    const result = ReusableConventionV1Schema.safeParse({
      name: "Bad Name",
      description: "x",
      must: {},
    });
    expect(result.success).toBe(false);
  });

  it("rejects MustBlock[] form (only object form allowed)", () => {
    const result = ReusableConventionV1Schema.safeParse({
      name: "x",
      description: "x",
      must: [{ must: { haveType: "file" } }],
    });
    expect(result.success).toBe(false);
  });

  it("rejects mustNot MustBlock[] form", () => {
    const result = ReusableConventionV1Schema.safeParse({
      name: "x",
      description: "x",
      mustNot: [{ must: { haveType: "file" } }],
    });
    expect(result.success).toBe(false);
  });

  it("rejects reusable conventions with neither must nor mustNot", () => {
    const result = ReusableConventionV1Schema.safeParse({
      name: "x",
      description: "x",
    });
    expect(result.success).toBe(false);
  });

  it("rejects missing description", () => {
    const result = ReusableConventionV1Schema.safeParse({
      name: "x",
      must: {},
    });
    expect(result.success).toBe(false);
  });
});

describe("ReusableConventionsPackageV1Schema", () => {
  it("accepts a valid package shape", () => {
    const result = ReusableConventionsPackageV1Schema.safeParse({
      conventionSpecVersion: "v1",
      conventions: [
        { name: "a", description: "d", must: { haveFiles: ["README.md"] } },
      ],
    });
    expect(result.success).toBe(true);
  });

  it("accepts a package convention with mustNot", () => {
    const result = ReusableConventionsPackageV1Schema.safeParse({
      conventionSpecVersion: "v1",
      conventions: [
        { name: "a", description: "d", mustNot: { export: ["debug"] } },
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

describe("defineConventions", () => {
  it("passes input through unchanged", () => {
    const input = [
      { name: "a", description: "d", must: { haveFiles: ["README.md"] } },
    ] as const satisfies readonly ReusableConventionV1[];
    const out = defineConventions(input);
    expect(out).toBe(input);
  });

  it("preserves the literal tuple type", () => {
    const out = defineConventions([
      { name: "a", description: "d", must: { haveFiles: ["README.md"] } },
    ]);
    expectTypeOf(out).toEqualTypeOf<
      readonly [
        {
          readonly name: "a";
          readonly description: "d";
          readonly must: { readonly haveFiles: readonly ["README.md"] };
        },
      ]
    >();
  });
});
