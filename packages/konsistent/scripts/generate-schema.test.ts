import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { resolve } from "node:path";
import Ajv from "ajv";
import { describe, expect, it } from "vitest";

const schemaPath = resolve(import.meta.dirname, "../konsistent.schema.json");
const fixturesDir = resolve(import.meta.dirname, "../../../e2e/fixtures");

const schema = JSON.parse(readFileSync(schemaPath, "utf-8"));
const ajv = new Ajv();
const validate = ajv.compile(schema);

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

function readFixtureConfig(fixtureName: string): unknown {
  const configPath = resolve(fixturesDir, fixtureName, "konsistent.json");
  return JSON.parse(readFileSync(configPath, "utf-8"));
}

describe("konsistent.schema.json", () => {
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

  it("rejects additionalProperties in the must object", () => {
    const handWrittenBranch = schema.properties.conventions.items.anyOf.find(
      (branch: { anyOf?: unknown[] }) => Array.isArray(branch.anyOf)
    );
    const objectBranch = handWrittenBranch.anyOf.find(
      (branch: { properties?: Record<string, unknown>; required?: string[] }) =>
        branch.required?.includes("must")
    );
    const mustSchema = objectBranch.properties.must;
    const predicatesSchema = mustSchema.anyOf[0];
    expect(predicatesSchema.additionalProperties).toBe(false);
  });

  it("rejects additionalProperties in the mustNot object", () => {
    const handWrittenBranch = schema.properties.conventions.items.anyOf.find(
      (branch: { anyOf?: unknown[] }) => Array.isArray(branch.anyOf)
    );
    const objectBranch = handWrittenBranch.anyOf.find(
      (branch: { properties?: Record<string, unknown>; required?: string[] }) =>
        branch.required?.includes("mustNot")
    );
    const mustNotSchema = objectBranch.properties.mustNot;
    expect(mustNotSchema.additionalProperties).toBe(false);
    expect(mustNotSchema.type).toBe("object");
  });

  const passingFixtures = readdirSync(fixturesDir).filter((name) => {
    if (name === "invalid-config") {
      return false;
    }
    const fixturePath = resolve(fixturesDir, name);
    if (!statSync(fixturePath).isDirectory()) {
      return false;
    }
    return existsSync(resolve(fixturePath, "konsistent.json"));
  });

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

  it("rejects exportTypes entries with both from and schema", () => {
    const valid = validate({
      version: "v1",
      conventions: [
        {
          paths: "src/settings.ts",
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

  it("rejects invalid characters in inner type references", () => {
    const valid = validate({
      version: "v1",
      conventions: [
        {
          paths: "src/settings.ts",
          must: {
            exportTypes: [
              {
                name: "Settings",
                schema: {
                  type: "object",
                  properties: { auth: { type: "MyAuth | null" } },
                },
              },
            ],
          },
        },
      ],
    });
    expect(valid).toBe(false);
  });
});
