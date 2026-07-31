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
      collectDeprecatedPropertySchemas({ value, into });
    }
    return into;
  }
  if (!(opts.value && typeof opts.value === "object")) {
    return into;
  }

  const record = opts.value as Record<string, unknown>;
  const properties = record.properties;
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
    collectDeprecatedPropertySchemas({ value, into });
  }
  return into;
}

describe("reusable-convention-package.schema.json", () => {
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
          name: "settings",
          description: "Settings exports.",
          must: {
            exportTypes: [
              {
                name: "LocalSettings",
                schema: { type: "object", properties: {} },
              },
              { name: "SharedSettings", from: "./settings" },
            ],
          },
        },
      ],
    });
    expect(valid).toBe(true);
  });

  it("rejects exportTypes entries with both from and schema", () => {
    const valid = validate({
      conventionSpecVersion: "v1",
      conventions: [
        {
          name: "settings",
          description: "Settings exports.",
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
    expect(valid).toBe(false);
  });
});
