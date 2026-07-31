import { describe, expect, it } from "vitest";
import { collectDeprecationWarnings } from "./deprecation-warnings.js";
import type { ConfigV1 } from "./schema.js";

describe("collectDeprecationWarnings", () => {
  it("reports every deprecated predicate with its replacement", () => {
    const config: ConfigV1 = {
      version: "v1",
      conventions: [
        {
          paths: "index.ts",
          must: {
            export: ["value"],
            import: ["value"],
            importFrom: "react",
            importFromCurrentDir: false,
            importFromParents: false,
            importFromExternals: false,
          },
        },
      ],
    };

    expect(collectDeprecationWarnings({ config })).toEqual([
      'Warning: "export" is deprecated in conventions[0].must.export. Use "exportValues" instead.',
      'Warning: "import" is deprecated in conventions[0].must.import. Use "importValues" instead.',
      'Warning: "importFrom" is deprecated in conventions[0].must.importFrom. Use "importValuesFrom" or "importTypesFrom" instead.',
      'Warning: "importFromCurrentDir" is deprecated in conventions[0].must.importFromCurrentDir. Use "importValuesFromCurrentDir" instead.',
      'Warning: "importFromParents" is deprecated in conventions[0].must.importFromParents. Use "importValuesFromParents" instead.',
      'Warning: "importFromExternals" is deprecated in conventions[0].must.importFromExternals. Use "importValuesFromExternals" instead.',
    ]);
  });

  it("reports deprecated fields in nested must and mustNot blocks", () => {
    const config: ConfigV1 = {
      version: "v1",
      conventions: [
        {
          paths: "index.ts",
          must: [
            {
              must: { import: ["value"] },
              mustNot: { export: ["debug"] },
            },
          ],
          mustNot: { importFrom: "legacy" },
        },
      ],
    };

    expect(collectDeprecationWarnings({ config })).toEqual([
      'Warning: "import" is deprecated in conventions[0].must[0].must.import. Use "importValues" instead.',
      'Warning: "export" is deprecated in conventions[0].must[0].mustNot.export. Use "exportValues" instead.',
      'Warning: "importFrom" is deprecated in conventions[0].mustNot.importFrom. Use "importValuesFrom" or "importTypesFrom" instead.',
    ]);
  });
});
