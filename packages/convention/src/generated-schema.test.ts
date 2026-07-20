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

describe("reusable-convention-package.schema.json", () => {
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
