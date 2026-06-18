import { describe, expect, it } from "vitest";
import { generateConventionName } from "./convention-name.js";

describe("generateConventionName", () => {
  describe("haveType", () => {
    it("generates must-be-{value}", () => {
      expect(generateConventionName({ must: { haveType: "directory" } })).toBe(
        "must-be-directory"
      );
    });

    it("generates must-be-file", () => {
      expect(generateConventionName({ must: { haveType: "file" } })).toBe(
        "must-be-file"
      );
    });
  });

  describe("haveFiles", () => {
    it("generates must-have-{first-file-kebab}", () => {
      expect(
        generateConventionName({ must: { haveFiles: ["index.ts"] } })
      ).toBe("must-have-index-ts");
    });

    it("appends -and-more for multiple files", () => {
      expect(
        generateConventionName({
          must: { haveFiles: ["index.ts", "types.ts"] },
        })
      ).toBe("must-have-index-ts-and-more");
    });

    it("converts path separators to hyphens", () => {
      expect(
        generateConventionName({ must: { haveFiles: ["src/index.ts"] } })
      ).toBe("must-have-src-index-ts");
    });
  });

  describe("export", () => {
    it("generates must-export-{name-kebab}", () => {
      expect(generateConventionName({ must: { export: ["activate"] } })).toBe(
        "must-export-activate"
      );
    });

    it("appends -and-more for multiple exports", () => {
      expect(
        generateConventionName({
          must: { export: ["activate", "deactivate"] },
        })
      ).toBe("must-export-activate-and-more");
    });

    it("strips template expressions and converts to kebab", () => {
      expect(
        generateConventionName({
          must: { export: ["create${name.toPascalCase()}Adapter"] },
        })
      ).toBe("must-export-create-adapter");
    });

    it("falls back when template stripping leaves empty string", () => {
      expect(
        generateConventionName({ must: { export: ["${providerId}"] } })
      ).toBe("must-export");
    });
  });

  describe("declareTypes", () => {
    it("generates must-declare-{name-kebab}-type", () => {
      expect(
        generateConventionName({
          must: { declareTypes: ["MyType"] },
        })
      ).toBe("must-declare-my-type-type");
    });
  });

  describe("declareConstants", () => {
    it("generates must-declare-{name-kebab}-constant", () => {
      expect(
        generateConventionName({
          must: { declareConstants: ["pluginId"] },
        })
      ).toBe("must-declare-plugin-id-constant");
    });
  });

  describe("declareFunctions", () => {
    it("generates must-declare-{name-kebab}-function", () => {
      expect(
        generateConventionName({
          must: {
            declareFunctions: [{ name: "create${name.toPascalCase()}Adapter" }],
          },
        })
      ).toBe("must-declare-create-adapter-function");
    });
  });

  describe("declareClasses", () => {
    it("generates must-declare-{name-kebab}-class", () => {
      expect(
        generateConventionName({
          must: {
            declareClasses: [{ name: "${name.toPascalCase()}Adapter" }],
          },
        })
      ).toBe("must-declare-adapter-class");
    });
  });

  describe("declareInterfaces", () => {
    it("generates must-declare-{name-kebab}-interface", () => {
      expect(
        generateConventionName({
          must: {
            declareInterfaces: [{ name: "${id.toPascalCase()}Provider" }],
          },
        })
      ).toBe("must-declare-provider-interface");
    });
  });

  describe("exportTypes", () => {
    it("generates must-export-{name-kebab}-type", () => {
      expect(
        generateConventionName({
          must: { exportTypes: ["MyType"] },
        })
      ).toBe("must-export-my-type-type");
    });

    it("strips templates and falls back", () => {
      expect(
        generateConventionName({
          must: {
            exportTypes: ["${id.toPascalCase()}Provider"],
          },
        })
      ).toBe("must-export-provider-type");
    });

    it("handles object form", () => {
      expect(
        generateConventionName({
          must: {
            exportTypes: [{ name: "${id.toPascalCase()}Provider" }],
          },
        })
      ).toBe("must-export-provider-type");
    });
  });

  describe("exportConstants", () => {
    it("generates must-export-{name-kebab}-constant", () => {
      expect(
        generateConventionName({
          must: { exportConstants: ["pluginId"] },
        })
      ).toBe("must-export-plugin-id-constant");
    });
  });

  describe("exportFunctions", () => {
    it("generates must-export-{name-kebab}-function", () => {
      expect(
        generateConventionName({
          must: {
            exportFunctions: [{ name: "create${name.toPascalCase()}Adapter" }],
          },
        })
      ).toBe("must-export-create-adapter-function");
    });

    it("strips templates from string form", () => {
      expect(
        generateConventionName({
          must: {
            exportFunctions: [
              { name: "create${serviceName.toPascalCase()}Service" },
            ],
          },
        })
      ).toBe("must-export-create-service-function");
    });
  });

  describe("exportClasses", () => {
    it("generates must-export-{name-kebab}-class", () => {
      expect(
        generateConventionName({
          must: {
            exportClasses: [{ name: "${name.toPascalCase()}Adapter" }],
          },
        })
      ).toBe("must-export-adapter-class");
    });
  });

  describe("exportInterfaces", () => {
    it("generates must-export-{name-kebab}-interface", () => {
      expect(
        generateConventionName({
          must: {
            exportInterfaces: [{ name: "${id.toPascalCase()}Provider" }],
          },
        })
      ).toBe("must-export-provider-interface");
    });
  });

  describe("import", () => {
    it("generates must-import-{name-kebab}", () => {
      expect(
        generateConventionName({
          must: {
            import: [{ name: "BaseAdapter", from: "@app/core" }],
          },
        })
      ).toBe("must-import-base-adapter");
    });
  });

  describe("importTypes", () => {
    it("generates must-import-{name-kebab}-type", () => {
      expect(
        generateConventionName({
          must: {
            importTypes: [{ name: "ProviderV1", from: "@ai-toolkit/core" }],
          },
        })
      ).toBe("must-import-provider-v1-type");
    });
  });

  describe("import source predicates", () => {
    it("generates current-dir import names", () => {
      expect(
        generateConventionName({ must: { importFromCurrentDir: true } })
      ).toBe("must-import-from-current-dir");
      expect(
        generateConventionName({ must: { importFromCurrentDir: false } })
      ).toBe("must-not-import-from-current-dir");
    });

    it("generates parent and external import names", () => {
      expect(
        generateConventionName({ must: { importFromParents: true } })
      ).toBe("must-import-from-parents");
      expect(
        generateConventionName({ must: { importFromExternals: false } })
      ).toBe("must-not-import-from-externals");
    });
  });

  describe("useDeclarationOrder", () => {
    it("generates declaration order names", () => {
      expect(
        generateConventionName({
          must: { useDeclarationOrder: ["create${name.toPascalCase()}"] },
        })
      ).toBe("must-use-create-declaration-order");
    });
  });

  describe("-and-more suffix", () => {
    it("appends when must object has multiple predicate keys", () => {
      expect(
        generateConventionName({
          must: {
            export: ["activate"],
            exportConstants: ["pluginId"],
          },
        })
      ).toBe("must-export-activate-and-more");
    });

    it("appends when predicate array has multiple items", () => {
      expect(
        generateConventionName({
          must: { export: ["activate", "deactivate"] },
        })
      ).toBe("must-export-activate-and-more");
    });

    it("appends when both conditions are true", () => {
      expect(
        generateConventionName({
          must: {
            export: ["activate", "deactivate"],
            exportConstants: ["pluginId"],
          },
        })
      ).toBe("must-export-activate-and-more");
    });
  });

  describe("MustBlock array", () => {
    it("uses first block first predicate", () => {
      expect(
        generateConventionName({
          must: [
            { must: { haveFiles: ["${componentName}.tsx"] } },
            { must: { export: ["describe"] } },
          ],
        })
      ).toBe("must-have-tsx");
    });

    it("handles template-only file name in haveFiles", () => {
      expect(
        generateConventionName({
          must: [{ must: { haveFiles: ["${name}.tsx"] } }],
        })
      ).toBe("must-have-tsx");
    });
  });

  describe("edge cases", () => {
    it("returns convention for empty must object", () => {
      expect(generateConventionName({ must: {} })).toBe("convention");
    });

    it("handles export with empty name after template strip and multiple keys", () => {
      expect(
        generateConventionName({
          must: {
            export: ["${providerId}"],
            exportTypes: ["${providerId.toPascalCase()}Provider"],
          },
        })
      ).toBe("must-export-and-more");
    });
  });
});
