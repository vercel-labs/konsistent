import { readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import Ajv from "ajv";
import { describe, expect, it } from "vitest";

const schemaPath = resolve(import.meta.dirname, "../konsistent.schema.json");
const fixturesDir = resolve(import.meta.dirname, "../../../e2e/fixtures");

const schema = JSON.parse(readFileSync(schemaPath, "utf-8"));
const ajv = new Ajv();
const validate = ajv.compile(schema);

function readFixtureConfig(fixtureName: string): unknown {
  const configPath = resolve(fixturesDir, fixtureName, "konsistent.json");
  return JSON.parse(readFileSync(configPath, "utf-8"));
}

describe("konsistent.schema.json", () => {
  it("is valid JSON Schema draft-07", () => {
    expect(schema.$schema).toBe("http://json-schema.org/draft-07/schema#");
  });

  it("has the correct $id URL", () => {
    expect(schema.$id).toBe(
      "https://unpkg.com/konsistent/konsistent.schema.json"
    );
  });

  it("requires version and conventions at the top level", () => {
    expect(schema.required).toContain("version");
    expect(schema.required).toContain("conventions");
  });

  it("allows additionalProperties in the must object", () => {
    const mustSchema = schema.properties.conventions.items.properties.must;
    const predicatesSchema = mustSchema.anyOf[0];
    expect(predicatesSchema.additionalProperties).toBe(true);
  });

  const passingFixtures = readdirSync(fixturesDir).filter(
    (name) => name !== "invalid-config"
  );

  for (const fixture of passingFixtures) {
    it(`validates passing fixture: ${fixture}`, () => {
      const config = readFixtureConfig(fixture);
      const valid = validate(config);
      if (!valid) {
        expect.fail(
          `Schema validation failed for ${fixture}: ${JSON.stringify(validate.errors)}`
        );
      }
    });
  }

  it("rejects the invalid-config fixture", () => {
    const config = readFixtureConfig("invalid-config");
    const valid = validate(config);
    expect(valid).toBe(false);
  });
});
