import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { collectDeprecationWarnings } from "./deprecation-warnings.js";
import { ConfigV1Schema } from "./schema.js";

const fixturePath = resolve(
  import.meta.dirname,
  "../../../../e2e/fixtures/deprecated-predicates/konsistent.json"
);

describe("collectDeprecationWarnings", () => {
  it("reports every deprecated predicate with its replacement", () => {
    const config = ConfigV1Schema.parse(
      JSON.parse(readFileSync(fixturePath, "utf-8"))
    );

    const warnings = collectDeprecationWarnings({ config });

    expect(warnings).toHaveLength(6);
    expect(warnings).toEqual(
      expect.arrayContaining([
        expect.stringContaining('Use "exportValues" instead.'),
        expect.stringContaining('Use "importValues" instead.'),
        expect.stringContaining(
          'Use "importValuesFrom" or "importTypesFrom" instead.'
        ),
        expect.stringContaining('Use "importValuesFromCurrentDir" instead.'),
        expect.stringContaining('Use "importValuesFromParents" instead.'),
        expect.stringContaining('Use "importValuesFromExternals" instead.'),
      ])
    );
  });
});
