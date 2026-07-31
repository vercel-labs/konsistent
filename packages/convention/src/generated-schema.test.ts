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

function collectPropertySchemas(opts: {
  value: unknown;
  propertyName: string;
  into?: Record<string, unknown>[];
}): Record<string, unknown>[] {
  const into = opts.into ?? [];
  if (Array.isArray(opts.value)) {
    for (const value of opts.value) {
      collectPropertySchemas({ value, propertyName: opts.propertyName, into });
    }
    return into;
  }
  if (!(opts.value && typeof opts.value === "object")) {
    return into;
  }

  const record = opts.value as Record<string, unknown>;
  const properties = record.properties;
  if (properties && typeof properties === "object") {
    const property = (properties as Record<string, unknown>)[opts.propertyName];
    if (property && typeof property === "object") {
      into.push(property as Record<string, unknown>);
    }
  }
  for (const value of Object.values(record)) {
    collectPropertySchemas({ value, propertyName: opts.propertyName, into });
  }
  return into;
}

describe("reusable-convention-package.schema.json", () => {
  it("marks legacy predicate properties as deprecated", () => {
    const replacements = {
      export: "Use exportValues instead.",
      import: "Use importValues instead.",
      importFrom: "Use importValuesFrom or importTypesFrom instead.",
      importFromCurrentDir: "Use importValuesFromCurrentDir instead.",
      importFromParents: "Use importValuesFromParents instead.",
      importFromExternals: "Use importValuesFromExternals instead.",
    };

    for (const [propertyName, description] of Object.entries(replacements)) {
      const matches = collectPropertySchemas({ value: schema, propertyName });
      expect(matches.length).toBeGreaterThan(0);
      expect(matches.every((match) => match.deprecated === true)).toBe(true);
      expect(matches.every((match) => match.description === description)).toBe(
        true
      );
    }
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
