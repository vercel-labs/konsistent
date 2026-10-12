import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import Ajv from "ajv";
import { describe, expect, it } from "vitest";

const schemaPath = resolve(
  import.meta.dirname,
  "../reusable-convention-package.schema.json"
);
const schema = JSON.parse(readFileSync(schemaPath, "utf-8"));
const validate = new Ajv().compile(schema);

function collectDeprecatedPropertySchemas(opts: {
  value: unknown;
  into?: Record<string, unknown>[];
}): Record<string, unknown>[] {
  const into = opts.into ?? [];
  if (Array.isArray(opts.value)) {
    for (const value of opts.value) {
      collectDeprecatedPropertySchemas({ into, value });
    }
    return into;
  }
  if (!(opts.value && typeof opts.value === "object")) {
    return into;
  }

  const record = opts.value as Record<string, unknown>;
  const { properties } = record;
  if (properties && typeof properties === "object") {
    for (const property of Object.values(properties)) {
      if (
        property &&
        typeof property === "object" &&
        (property as Record<string, unknown>).deprecated === true
      ) {
        into.push(property as Record<string, unknown>);
      }
    }
  }
  for (const value of Object.values(record)) {
    collectDeprecatedPropertySchemas({ into, value });
  }
  return into;
}

describe("reusable-convention-package.schema.json", () => {
  it("accepts directory conditions and assertions in reusable conventions", () => {
    expect(
      validate({
        conventionSpecVersion: "v1",
        conventions: [
          {
            description: "Require directory structure.",
            if: { hasDirectory: "instructions.{md,ts}" },
            ifNot: { hasDirectory: "skip" },
            must: { haveDirectories: ["instructions/*"] },
            mustNot: { haveDirectories: ["secret/*"] },
            name: "directories",
          },
        ],
      })
    ).toBe(true);
  });
  it("accepts export source predicates in reusable conventions", () => {
    expect(
      validate({
        conventionSpecVersion: "v1",
        conventions: [
          {
            description: "Re-export source checks.",
            must: {
              exportTypesFromParents: true,
              exportValuesFrom: ["pkg/*", "!pkg/private/*"],
            },
            mustNot: {
              exportTypesFrom: "./internal",
              exportValuesFromExternals: true,
            },
            name: "sources",
          },
        ],
      })
    ).toBe(true);
  });

  it("marks legacy predicate properties as deprecated", () => {
    const matches = collectDeprecatedPropertySchemas({ value: schema });
    expect(matches.length).toBeGreaterThan(0);
    expect(new Set(matches.map((match) => match.description))).toEqual(
      new Set([
        "Use exportValues instead.",
        "Use importValues instead.",
        "Use importValuesFrom or importTypesFrom instead.",
        "Use importValuesFromCurrentDir instead.",
        "Use importValuesFromParents instead.",
        "Use importValuesFromExternals instead.",
      ])
    );
  });

  it("accepts separate schema and from exportTypes entries", () => {
    const valid = validate({
      conventionSpecVersion: "v1",
      conventions: [
        {
          description: "Settings exports.",
          must: {
            exportTypes: [
              {
                name: "LocalSettings",
                schema: {
                  properties: {
                    auth: "Readonly<MyAuth>",
                  },
                  type: "object",
                },
              },
              { from: "./settings", name: "SharedSettings" },
            ],
          },
          name: "settings",
        },
      ],
    });
    expect(valid).toBe(true);
  });

  it("accepts exact top-level type constraints", () => {
    const valid = validate({
      conventionSpecVersion: "v1",
      conventions: [
        {
          description: "Exact declaration types.",
          must: {
            declareConstants: [
              { name: "internalValue", type: "SharedType<'internal'>" },
            ],
            declareTypes: [
              { name: "InternalType", type: "SharedType<'internal'>" },
            ],
            exportConstants: [
              { name: "publicValue", type: "SharedType<'public'>" },
            ],
            exportTypes: [{ name: "PublicType", type: "SharedType<'public'>" }],
          },
          name: "exact-types",
        },
      ],
    });
    expect(valid).toBe(true);
  });

  it("rejects the legacy object form for inner type references", () => {
    const valid = validate({
      conventionSpecVersion: "v1",
      conventions: [
        {
          description: "Settings exports.",
          must: {
            exportTypes: [
              {
                name: "Settings",
                schema: {
                  properties: { auth: { type: "MyAuth | null" } },
                  type: "object",
                },
              },
            ],
          },
          name: "settings",
        },
      ],
    });
    expect(valid).toBe(false);
  });

  it("accepts aliases for current value and type symbol predicates", () => {
    const valid = validate({
      conventionSpecVersion: "v1",
      conventions: [
        {
          description: "Symbol aliases.",
          must: {
            exportTypes: [{ alias: "PublicType", name: "LocalType" }],
            exportValues: [{ alias: "publicValue", name: "localValue" }],
            importTypes: [{ alias: "LocalType", name: "SourceType" }],
            importValues: [{ alias: "localValue", name: "sourceValue" }],
          },
          name: "aliases",
        },
      ],
    });
    expect(valid).toBe(true);
  });

  it("accepts value and type import conditions through if and ifNot", () => {
    const conditions = [
      { hasValueImport: { from: "./client", name: "createClient" } },
      { hasValueImportFrom: "./client" },
      { hasTypeImport: { from: "./client", name: "Client" } },
      { hasTypeImportFrom: "./client" },
    ];

    for (const conditionField of ["if", "ifNot"]) {
      for (const [index, condition] of conditions.entries()) {
        const valid = validate({
          conventionSpecVersion: "v1",
          conventions: [
            {
              description: "Import condition.",
              name: `import-condition-${index}`,
              [conditionField]: condition,
              must: { haveType: "file" },
            },
          ],
        });
        expect(valid).toBe(true);
      }
    }
  });

  it("rejects aliases in import conditions", () => {
    const valid = validate({
      conventionSpecVersion: "v1",
      conventions: [
        {
          description: "Import condition.",
          if: {
            hasValueImport: {
              alias: "createApiClient",
              name: "createClient",
            },
          },
          must: { haveType: "file" },
          name: "import-condition",
        },
      ],
    });
    expect(valid).toBe(false);
  });

  it.each(["import", "export"])(
    "rejects aliases for the deprecated %s predicate",
    (predicate) => {
      const valid = validate({
        conventionSpecVersion: "v1",
        conventions: [
          {
            description: "Legacy predicate.",
            must: {
              [predicate]: [{ alias: "publicName", name: "source" }],
            },
            name: "legacy",
          },
        ],
      });
      expect(valid).toBe(false);
    }
  );

  it("rejects exportTypes entries with both from and schema", () => {
    const valid = validate({
      conventionSpecVersion: "v1",
      conventions: [
        {
          description: "Settings exports.",
          must: {
            exportTypes: [
              {
                from: "./settings",
                name: "Settings",
                schema: { properties: {}, type: "object" },
              },
            ],
          },
          name: "settings",
        },
      ],
    });
    expect(valid).toBe(false);
  });

  it("rejects conflicting top-level type constraints", () => {
    const valid = validate({
      conventionSpecVersion: "v1",
      conventions: [
        {
          description: "Settings exports.",
          must: {
            exportTypes: [
              {
                name: "Settings",
                schema: { properties: {}, type: "object" },
                type: "SharedSettings",
              },
            ],
          },
          name: "settings",
        },
      ],
    });
    expect(valid).toBe(false);
  });
});
