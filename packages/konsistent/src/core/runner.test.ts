import { describe, expect, it, vi } from "vitest";
import type { ConfigV1, IfConditionV1 } from "../config/schema.js";
import type { FileSystem } from "./filesystem.js";
import { run } from "./runner.js";

function createMockFileSystem(opts: {
  globResults?: Map<string, string[]>;
  files?: Set<string>;
  directories?: Set<string>;
  fileContents?: Map<string, string>;
}): FileSystem {
  const globResults = opts.globResults ?? new Map<string, string[]>();
  const files = opts.files ?? new Set<string>();
  const directories = opts.directories ?? new Set<string>();
  const fileContents = opts.fileContents ?? new Map<string, string>();
  return {
    glob(patterns: string[]): Promise<string[]> {
      const key = patterns.sort().join(",");
      return Promise.resolve(globResults.get(key) ?? []);
    },
    isDirectory: (p: string) => directories.has(p),
    isFile: (p: string) => files.has(p),
    fileExists: (p: string) => files.has(p) || directories.has(p),
    readDir: () => [],
    readFile: (p: string) => fileContents.get(p) ?? "",
  };
}

function createMatchingConditions(): IfConditionV1[] {
  return [
    { hasFile: "marker.ts" },
    { placeholderSatisfies: "moduleName:matches(^client$)" },
    {
      hasValueImport: {
        name: "create${moduleName.toPascalCase()}",
        from: "./${moduleName}",
      },
    },
    { hasValueImportFrom: "./${moduleName}" },
    { hasTypeImport: { name: "${moduleName.toPascalCase()}" } },
    { hasTypeImportFrom: "./${moduleName}" },
  ];
}

describe("run", () => {
  it("bounds ancestor conventions and nested file blocks to selected paths", async () => {
    const config: ConfigV1 = {
      version: "v1",
      conventions: [
        {
          paths: "components/{componentName}",
          must: [
            {
              for: { files: "${componentName}.test.tsx" },
              must: { exportValues: ["describe"] },
            },
          ],
        },
      ],
    };
    const fs = createMockFileSystem({
      directories: new Set(["components/Button", "components/Input"]),
      files: new Set([
        "components/Button/Button.test.tsx",
        "components/Input/Input.test.tsx",
      ]),
      fileContents: new Map([
        ["components/Button/Button.test.tsx", "export const describe = true;"],
        ["components/Input/Input.test.tsx", "export const invalid = true;"],
      ]),
    });
    const globSpy = vi.spyOn(fs, "glob");
    const readSpy = vi.spyOn(fs, "readFile");

    const result = await run({
      config,
      fileSystem: fs,
      pathSelection: {
        mode: "targeted",
        selectedPaths: ["components/Button/Button.test.tsx"],
        structuralPaths: [
          ".",
          "components",
          "components/Button",
          "components/Button/Button.test.tsx",
        ],
      },
    });

    expect(result.diagnostics).toEqual([]);
    expect(result.filesChecked).toBe(2);
    expect(globSpy).not.toHaveBeenCalled();
    expect(readSpy).toHaveBeenCalledTimes(1);
    expect(readSpy).toHaveBeenCalledWith("components/Button/Button.test.tsx");
  });

  it("returns empty diagnostics for empty conventions", async () => {
    const config: ConfigV1 = { version: "v1", conventions: [] };
    const { diagnostics, filesChecked } = await run({
      config,
      fileSystem: createMockFileSystem({}),
    });
    expect(diagnostics).toEqual([]);
    expect(filesChecked).toBe(0);
  });

  it("returns diagnostics when haveType fails", async () => {
    const config: ConfigV1 = {
      version: "v1",
      conventions: [
        {
          name: "source-files",
          paths: "src/**/*.ts",
          must: { haveType: "file" },
        },
      ],
    };
    const fs = createMockFileSystem({
      globResults: new Map([["src/**/*.ts", ["src/utils"]]]),
      directories: new Set(["src/utils"]),
    });
    const { diagnostics } = await run({ config, fileSystem: fs });
    expect(diagnostics).toHaveLength(1);
    expect(diagnostics[0].message).toBe(
      "Expected a file but found a directory"
    );
    expect(diagnostics[0].conventionName).toBe("source-files");
  });

  it("returns no diagnostics when haveType matches", async () => {
    const config: ConfigV1 = {
      version: "v1",
      conventions: [
        {
          paths: "src/**/*.ts",
          must: { haveType: "file" },
        },
      ],
    };
    const fs = createMockFileSystem({
      globResults: new Map([["src/**/*.ts", ["src/index.ts"]]]),
      files: new Set(["src/index.ts"]),
    });
    const { diagnostics, filesChecked } = await run({
      config,
      fileSystem: fs,
    });
    expect(diagnostics).toEqual([]);
    expect(filesChecked).toBe(1);
  });

  it("normalizes paths string to array", async () => {
    const config: ConfigV1 = {
      version: "v1",
      conventions: [
        {
          paths: "src/**",
          must: { haveType: "directory" },
        },
      ],
    };
    const fs = createMockFileSystem({
      globResults: new Map([["src/**", ["src/components"]]]),
      directories: new Set(["src/components"]),
    });
    const { diagnostics } = await run({ config, fileSystem: fs });
    expect(diagnostics).toEqual([]);
  });

  it("handles array paths", async () => {
    const config: ConfigV1 = {
      version: "v1",
      conventions: [
        {
          paths: ["src/**/*.ts", "lib/**/*.ts"],
          must: { haveType: "file" },
        },
      ],
    };
    const fs = createMockFileSystem({
      globResults: new Map([
        ["lib/**/*.ts,src/**/*.ts", ["src/a.ts", "lib/b.ts"]],
      ]),
      files: new Set(["src/a.ts", "lib/b.ts"]),
    });
    const { diagnostics, filesChecked } = await run({
      config,
      fileSystem: fs,
    });
    expect(diagnostics).toEqual([]);
    expect(filesChecked).toBe(2);
  });

  it("silently skips unrecognized predicate keys", async () => {
    const config: ConfigV1 = {
      version: "v1",
      conventions: [
        {
          paths: "src/**",
          must: {} as ConfigV1["conventions"][0]["must"],
        },
      ],
    };
    const fs = createMockFileSystem({
      globResults: new Map([["src/**", ["src/index.ts"]]]),
      files: new Set(["src/index.ts"]),
    });
    const { diagnostics } = await run({ config, fileSystem: fs });
    expect(diagnostics).toEqual([]);
  });

  it("reports diagnostics when mustNot scalar predicates pass", async () => {
    const config: ConfigV1 = {
      version: "v1",
      conventions: [
        {
          name: "not-files",
          paths: "src/**/*.ts",
          mustNot: { haveType: "file" },
        },
      ],
    };
    const fs = createMockFileSystem({
      globResults: new Map([["src/**/*.ts", ["src/index.ts"]]]),
      files: new Set(["src/index.ts"]),
    });
    const { diagnostics } = await run({ config, fileSystem: fs });
    expect(diagnostics).toHaveLength(1);
    expect(diagnostics[0].predicateName).toBe("mustNot.haveType");
    expect(diagnostics[0].message).toBe('Forbidden path type "file"');
    expect(diagnostics[0].conventionName).toBe("not-files");
  });

  it("returns no diagnostics when mustNot scalar predicates fail", async () => {
    const config: ConfigV1 = {
      version: "v1",
      conventions: [
        {
          paths: "src/**/*.ts",
          mustNot: { haveType: "file" },
        },
      ],
    };
    const fs = createMockFileSystem({
      globResults: new Map([["src/**/*.ts", ["src/utils"]]]),
      directories: new Set(["src/utils"]),
    });
    const { diagnostics } = await run({ config, fileSystem: fs });
    expect(diagnostics).toEqual([]);
  });

  it("negates list predicates per item", async () => {
    const config: ConfigV1 = {
      version: "v1",
      conventions: [
        {
          paths: "src/module.ts",
          mustNot: { exportConstants: ["debug", "missing"] },
        },
      ],
    };
    const fs = createMockFileSystem({
      globResults: new Map([["src/module.ts", ["src/module.ts"]]]),
      files: new Set(["src/module.ts"]),
      fileContents: new Map([["src/module.ts", "export const debug = true;"]]),
    });
    const { diagnostics } = await run({ config, fileSystem: fs });
    expect(diagnostics).toHaveLength(1);
    expect(diagnostics[0].predicateName).toBe("mustNot.exportConstants");
    expect(diagnostics[0].message).toBe('Forbidden constant export "debug"');
  });

  it("forbids exact import and export alias pairs", async () => {
    const config: ConfigV1 = {
      version: "v1",
      conventions: [
        {
          paths: "src/module.ts",
          mustNot: {
            importValues: [{ name: "sourceValue", alias: "localValue" }],
            importTypes: [{ name: "SourceType", alias: "LocalType" }],
            exportValues: [{ name: "sourceExport", alias: "publicValue" }],
            exportTypes: [{ name: "SourceExportType", alias: "PublicType" }],
          },
        },
      ],
    };
    const fs = createMockFileSystem({
      globResults: new Map([["src/module.ts", ["src/module.ts"]]]),
      files: new Set(["src/module.ts"]),
      fileContents: new Map([
        [
          "src/module.ts",
          [
            'import { sourceValue as localValue } from "pkg";',
            'import type { SourceType as LocalType } from "types";',
            "const sourceExport = 1;",
            "type SourceExportType = string;",
            "export { sourceExport as publicValue };",
            "export type { SourceExportType as PublicType };",
          ].join("\n"),
        ],
      ]),
    });
    const { diagnostics } = await run({ config, fileSystem: fs });
    expect(diagnostics.map((diagnostic) => diagnostic.message)).toEqual([
      'Forbidden import "sourceValue" as "localValue"',
      'Forbidden type import "SourceType" as "LocalType"',
      'Forbidden export "sourceExport" as "publicValue"',
      'Forbidden type export "SourceExportType" as "PublicType"',
    ]);
  });

  it("allows a different alias when mustNot configures an exact pair", async () => {
    const config: ConfigV1 = {
      version: "v1",
      conventions: [
        {
          paths: "src/module.ts",
          mustNot: {
            importValues: [{ name: "sourceValue", alias: "blockedValue" }],
            importTypes: [{ name: "SourceType", alias: "BlockedType" }],
            exportValues: [{ name: "sourceExport", alias: "blockedExport" }],
            exportTypes: [
              { name: "SourceExportType", alias: "BlockedExportType" },
            ],
          },
        },
      ],
    };
    const fs = createMockFileSystem({
      globResults: new Map([["src/module.ts", ["src/module.ts"]]]),
      files: new Set(["src/module.ts"]),
      fileContents: new Map([
        [
          "src/module.ts",
          [
            'import { sourceValue as allowedValue } from "pkg";',
            'import type { SourceType as AllowedType } from "types";',
            "const sourceExport = 1;",
            "type SourceExportType = string;",
            "export { sourceExport as allowedExport };",
            "export type { SourceExportType as AllowedExportType };",
          ].join("\n"),
        ],
      ]),
    });
    const { diagnostics } = await run({ config, fileSystem: fs });
    expect(diagnostics).toEqual([]);
  });

  it("forbids original names under any named alias when alias is omitted", async () => {
    const config: ConfigV1 = {
      version: "v1",
      conventions: [
        {
          paths: "src/module.ts",
          mustNot: {
            importValues: ["sourceValue"],
            importTypes: ["SourceType"],
            exportValues: ["sourceExport"],
            exportTypes: ["SourceExportType"],
          },
        },
      ],
    };
    const fs = createMockFileSystem({
      globResults: new Map([["src/module.ts", ["src/module.ts"]]]),
      files: new Set(["src/module.ts"]),
      fileContents: new Map([
        [
          "src/module.ts",
          [
            'import { sourceValue as localValue } from "pkg";',
            'import type { SourceType as LocalType } from "types";',
            "const sourceExport = 1;",
            "type SourceExportType = string;",
            "export { sourceExport as publicValue };",
            "export type { SourceExportType as PublicType };",
          ].join("\n"),
        ],
      ]),
    });
    const { diagnostics } = await run({ config, fileSystem: fs });
    expect(diagnostics.map((diagnostic) => diagnostic.message)).toEqual([
      'Forbidden import "sourceValue"',
      'Forbidden type import "SourceType"',
      'Forbidden export "sourceExport"',
      'Forbidden type export "SourceExportType"',
    ]);
  });

  it("forbids a constant matching a mustNot schema", async () => {
    const config: ConfigV1 = {
      version: "v1",
      conventions: [
        {
          paths: "src/module.ts",
          mustNot: {
            exportConstants: [{ name: "debug", schema: { type: "boolean" } }],
          },
        },
      ],
    };
    const fs = createMockFileSystem({
      globResults: new Map([["src/module.ts", ["src/module.ts"]]]),
      files: new Set(["src/module.ts"]),
      fileContents: new Map([
        ["src/module.ts", "export const debug: boolean = true;"],
      ]),
    });
    const { diagnostics } = await run({ config, fileSystem: fs });
    expect(diagnostics).toHaveLength(1);
    expect(diagnostics[0].predicateName).toBe("mustNot.exportConstants");
    expect(diagnostics[0].message).toBe('Forbidden constant export "debug"');
  });

  it("allows a mustNot constant with a different schema", async () => {
    const config: ConfigV1 = {
      version: "v1",
      conventions: [
        {
          paths: "src/module.ts",
          mustNot: {
            exportConstants: [{ name: "debug", schema: { type: "boolean" } }],
          },
        },
      ],
    };
    const fs = createMockFileSystem({
      globResults: new Map([["src/module.ts", ["src/module.ts"]]]),
      files: new Set(["src/module.ts"]),
      fileContents: new Map([
        ["src/module.ts", 'export const debug: string = "true";'],
      ]),
    });
    const { diagnostics } = await run({ config, fileSystem: fs });
    expect(diagnostics).toEqual([]);
  });

  it("forbids an exported type matching a mustNot schema", async () => {
    const config: ConfigV1 = {
      version: "v1",
      conventions: [
        {
          paths: "src/module.ts",
          mustNot: {
            exportTypes: [
              {
                name: "DebugSettings",
                schema: {
                  type: "object",
                  properties: { enabled: { type: "boolean" } },
                },
              },
            ],
          },
        },
      ],
    };
    const fs = createMockFileSystem({
      globResults: new Map([["src/module.ts", ["src/module.ts"]]]),
      files: new Set(["src/module.ts"]),
      fileContents: new Map([
        ["src/module.ts", "export type DebugSettings = { enabled?: boolean };"],
      ]),
    });
    const { diagnostics } = await run({ config, fileSystem: fs });
    expect(diagnostics).toHaveLength(1);
    expect(diagnostics[0].predicateName).toBe("mustNot.exportTypes");
    expect(diagnostics[0].message).toBe(
      'Forbidden type export "DebugSettings"'
    );
  });

  it("allows a mustNot exported type with different optionality", async () => {
    const config: ConfigV1 = {
      version: "v1",
      conventions: [
        {
          paths: "src/module.ts",
          mustNot: {
            exportTypes: [
              {
                name: "DebugSettings",
                schema: {
                  type: "object",
                  properties: { enabled: { type: "boolean" } },
                },
              },
            ],
          },
        },
      ],
    };
    const fs = createMockFileSystem({
      globResults: new Map([["src/module.ts", ["src/module.ts"]]]),
      files: new Set(["src/module.ts"]),
      fileContents: new Map([
        ["src/module.ts", "export type DebugSettings = { enabled: boolean };"],
      ]),
    });
    const { diagnostics } = await run({ config, fileSystem: fs });
    expect(diagnostics).toEqual([]);
  });

  it("returns no diagnostics when mustNot importValuesFrom does not match a subpath", async () => {
    const config: ConfigV1 = {
      version: "v1",
      conventions: [
        {
          paths: "src/module.ts",
          mustNot: { importValuesFrom: "package" },
        },
      ],
    };
    const fs = createMockFileSystem({
      globResults: new Map([["src/module.ts", ["src/module.ts"]]]),
      files: new Set(["src/module.ts"]),
      fileContents: new Map([
        ["src/module.ts", "import { value } from 'package/v4';"],
      ]),
    });
    const { diagnostics } = await run({ config, fileSystem: fs });
    expect(diagnostics).toEqual([]);
  });

  it("reports diagnostics when mustNot importValuesFrom wildcard matches a subpath", async () => {
    const config: ConfigV1 = {
      version: "v1",
      conventions: [
        {
          paths: "src/module.ts",
          mustNot: { importValuesFrom: "package/*" },
        },
      ],
    };
    const fs = createMockFileSystem({
      globResults: new Map([["src/module.ts", ["src/module.ts"]]]),
      files: new Set(["src/module.ts"]),
      fileContents: new Map([
        ["src/module.ts", "import { value } from 'package/v4';"],
      ]),
    });
    const { diagnostics } = await run({ config, fileSystem: fs });
    expect(diagnostics).toHaveLength(1);
    expect(diagnostics[0].predicateName).toBe("mustNot.importValuesFrom");
    expect(diagnostics[0].message).toBe('Forbidden import from "package/*"');
  });

  it("reports diagnostics per matching mustNot importValuesFrom array item", async () => {
    const config: ConfigV1 = {
      version: "v1",
      conventions: [
        {
          paths: "src/module.ts",
          mustNot: { importValuesFrom: ["react", "package/*", "never"] },
        },
      ],
    };
    const fs = createMockFileSystem({
      globResults: new Map([["src/module.ts", ["src/module.ts"]]]),
      files: new Set(["src/module.ts"]),
      fileContents: new Map([
        [
          "src/module.ts",
          [
            "import React from 'react';",
            "import { value } from 'package/v4';",
          ].join("\n"),
        ],
      ]),
    });
    const { diagnostics } = await run({ config, fileSystem: fs });
    expect(diagnostics.map((d) => d.message)).toEqual([
      'Forbidden import from "react"',
      'Forbidden import from "package/*"',
    ]);
  });

  it("allows excluded value imports in a mustNot selector", async () => {
    const config: ConfigV1 = {
      version: "v1",
      conventions: [
        {
          paths: "src/module.ts",
          mustNot: {
            importValuesFrom: [
              "@ai-sdk/*",
              "!@ai-sdk/harness",
              "!@ai-sdk/harness/*",
              "@ai-sdk/harness/bridge",
            ],
          },
        },
      ],
    };
    const fs = createMockFileSystem({
      globResults: new Map([["src/module.ts", ["src/module.ts"]]]),
      files: new Set(["src/module.ts"]),
      fileContents: new Map([
        [
          "src/module.ts",
          [
            "import { harness } from '@ai-sdk/harness';",
            "import { testing } from '@ai-sdk/harness/testing';",
          ].join("\n"),
        ],
      ]),
    });

    const { diagnostics } = await run({ config, fileSystem: fs });
    expect(diagnostics).toEqual([]);
  });

  it("forbids selected and re-included value imports as one selector", async () => {
    const config: ConfigV1 = {
      version: "v1",
      conventions: [
        {
          paths: "src/module.ts",
          mustNot: {
            importValuesFrom: [
              "@ai-sdk/*",
              "!@ai-sdk/harness",
              "!@ai-sdk/harness/*",
              "@ai-sdk/harness/bridge",
            ],
          },
        },
      ],
    };
    const fs = createMockFileSystem({
      globResults: new Map([["src/module.ts", ["src/module.ts"]]]),
      files: new Set(["src/module.ts"]),
      fileContents: new Map([
        [
          "src/module.ts",
          [
            "import { core } from '@ai-sdk/core';",
            "import { bridge } from '@ai-sdk/harness/bridge';",
          ].join("\n"),
        ],
      ]),
    });

    const { diagnostics } = await run({ config, fileSystem: fs });
    expect(diagnostics).toHaveLength(1);
    expect(diagnostics[0].predicateName).toBe("mustNot.importValuesFrom");
    expect(diagnostics[0].message).toBe('Forbidden import from "@ai-sdk/*"');
  });

  it("groups type import selectors while keeping exact constraints additive", async () => {
    const config: ConfigV1 = {
      version: "v1",
      conventions: [
        {
          paths: "src/module.ts",
          mustNot: {
            importTypesFrom: ["react", "@vendor/*", "!@vendor/allowed"],
          },
        },
      ],
    };
    const fs = createMockFileSystem({
      globResults: new Map([["src/module.ts", ["src/module.ts"]]]),
      files: new Set(["src/module.ts"]),
      fileContents: new Map([
        [
          "src/module.ts",
          [
            "import type { ReactNode } from 'react';",
            "import type { Tool } from '@vendor/project';",
          ].join("\n"),
        ],
      ]),
    });

    const { diagnostics } = await run({ config, fileSystem: fs });
    expect(diagnostics.map((diagnostic) => diagnostic.message)).toEqual([
      'Forbidden type import from "react"',
      'Forbidden type import from "@vendor/*"',
    ]);
  });

  it("applies block metadata to mustNot predicates", async () => {
    const config: ConfigV1 = {
      version: "v1",
      conventions: [
        {
          name: "components",
          paths: "components/{name}",
          severity: "warning",
          must: [
            {
              name: "no-debug-tests",
              if: { hasFile: "${name}.test.ts" },
              for: { files: "*.test.ts" },
              excludeFiles: ["helpers.test.ts"],
              mustNot: { exportConstants: ["debug"] },
            },
          ],
        },
      ],
    };
    const fs = createMockFileSystem({
      globResults: new Map([
        ["components/*", ["components/Button"]],
        [
          "components/Button/*.test.ts",
          [
            "components/Button/Button.test.ts",
            "components/Button/helpers.test.ts",
          ],
        ],
      ]),
      directories: new Set(["components/Button"]),
      files: new Set([
        "components/Button/Button.test.ts",
        "components/Button/helpers.test.ts",
      ]),
      fileContents: new Map([
        ["components/Button/Button.test.ts", "export const debug = true;"],
        ["components/Button/helpers.test.ts", "export const debug = true;"],
      ]),
    });
    const { diagnostics } = await run({ config, fileSystem: fs });
    expect(diagnostics).toHaveLength(1);
    expect(diagnostics[0].filePath).toBe("components/Button/Button.test.ts");
    expect(diagnostics[0].conventionName).toBe("no-debug-tests");
    expect(diagnostics[0].severity).toBe("warning");
  });

  it("evaluates must block when if.hasFile condition is met", async () => {
    const config: ConfigV1 = {
      version: "v1",
      conventions: [
        {
          name: "conditional-rule",
          paths: "src/**/*.ts",
          must: [
            {
              if: { hasFile: "schema.ts" },
              must: { haveType: "directory" },
            },
          ],
        },
      ],
    };
    const fs = createMockFileSystem({
      globResults: new Map([["src/**/*.ts", ["src/models/index.ts"]]]),
      files: new Set(["src/models/index.ts", "src/models/schema.ts"]),
    });
    const { diagnostics } = await run({ config, fileSystem: fs });
    expect(diagnostics).toHaveLength(1);
    expect(diagnostics[0].message).toBe(
      "Expected a directory but found a file"
    );
    expect(diagnostics[0].conventionName).toBe("conditional-rule");
  });

  it("evaluates a top-level condition per matched path and gates every block", async () => {
    const config: ConfigV1 = {
      version: "v1",
      conventions: [
        {
          name: "conditional-convention",
          paths: "packages/{packageName}",
          if: { hasFile: "gate.ts" },
          must: [
            {
              name: "matching-block-condition",
              if: { hasFile: "block-gate.ts" },
              must: { haveFiles: ["required.ts"] },
            },
            {
              name: "non-matching-block-condition",
              if: { hasFile: "absent.ts" },
              must: { haveFiles: ["also-required.ts"] },
            },
            {
              name: "gated-must-not",
              mustNot: { haveType: "directory" },
            },
          ],
        },
      ],
    };
    const fs = createMockFileSystem({
      globResults: new Map([
        ["packages/*", ["packages/matching", "packages/non-matching"]],
      ]),
      directories: new Set(["packages/matching", "packages/non-matching"]),
      files: new Set([
        "packages/matching/gate.ts",
        "packages/matching/block-gate.ts",
        "packages/non-matching/block-gate.ts",
      ]),
    });

    const { diagnostics } = await run({ config, fileSystem: fs });

    expect(diagnostics).toHaveLength(2);
    expect(diagnostics.map((diagnostic) => diagnostic.filePath)).toEqual([
      "packages/matching",
      "packages/matching",
    ]);
    expect(diagnostics.map((diagnostic) => diagnostic.conventionName)).toEqual([
      "matching-block-condition",
      "gated-must-not",
    ]);
  });

  it("skips must block when if.hasFile condition is not met", async () => {
    const config: ConfigV1 = {
      version: "v1",
      conventions: [
        {
          name: "conditional-rule",
          paths: "src/**/*.ts",
          must: [
            {
              if: { hasFile: "schema.ts" },
              must: { haveType: "directory" },
            },
          ],
        },
      ],
    };
    const fs = createMockFileSystem({
      globResults: new Map([["src/**/*.ts", ["src/models/index.ts"]]]),
      files: new Set(["src/models/index.ts"]),
    });
    const { diagnostics } = await run({ config, fileSystem: fs });
    expect(diagnostics).toEqual([]);
  });

  it("evaluates must block unconditionally when no if is present", async () => {
    const config: ConfigV1 = {
      version: "v1",
      conventions: [
        {
          name: "unconditional-rule",
          paths: "src/**/*.ts",
          must: [{ must: { haveType: "file" } }],
        },
      ],
    };
    const fs = createMockFileSystem({
      globResults: new Map([["src/**/*.ts", ["src/utils"]]]),
      directories: new Set(["src/utils"]),
    });
    const { diagnostics } = await run({ config, fileSystem: fs });
    expect(diagnostics).toHaveLength(1);
    expect(diagnostics[0].message).toBe(
      "Expected a file but found a directory"
    );
  });

  it("evaluates must block when if.placeholderSatisfies is met", async () => {
    const config: ConfigV1 = {
      version: "v1",
      conventions: [
        {
          name: "satisfies-rule",
          paths: "packages/{providerId}",
          must: [
            {
              if: { placeholderSatisfies: "providerId:matches(^[a-z]+ai$)" },
              must: { haveType: "file" },
            },
          ],
        },
      ],
    };
    const fs = createMockFileSystem({
      globResults: new Map([["packages/*", ["packages/openai"]]]),
      directories: new Set(["packages/openai"]),
    });
    const { diagnostics } = await run({ config, fileSystem: fs });
    expect(diagnostics).toHaveLength(1);
    expect(diagnostics[0].message).toBe(
      "Expected a file but found a directory"
    );
    expect(diagnostics[0].conventionName).toBe("satisfies-rule");
  });

  it("skips must block when if.placeholderSatisfies is not met", async () => {
    const config: ConfigV1 = {
      version: "v1",
      conventions: [
        {
          name: "satisfies-rule",
          paths: "packages/{providerId}",
          must: [
            {
              if: { placeholderSatisfies: "providerId:matches(^[a-z]+ai$)" },
              must: { haveType: "file" },
            },
          ],
        },
      ],
    };
    const fs = createMockFileSystem({
      globResults: new Map([["packages/*", ["packages/google"]]]),
      directories: new Set(["packages/google"]),
    });
    const { diagnostics } = await run({ config, fileSystem: fs });
    expect(diagnostics).toEqual([]);
  });

  it("skips must block when if.placeholderSatisfies references unknown placeholder", async () => {
    const config: ConfigV1 = {
      version: "v1",
      conventions: [
        {
          name: "satisfies-rule",
          paths: "packages/{providerId}",
          must: [
            {
              if: { placeholderSatisfies: "typo:matches(^[a-z]+ai$)" },
              must: { haveType: "file" },
            },
          ],
        },
      ],
    };
    const fs = createMockFileSystem({
      globResults: new Map([["packages/*", ["packages/openai"]]]),
      directories: new Set(["packages/openai"]),
    });
    const { diagnostics } = await run({ config, fileSystem: fs });
    expect(diagnostics).toEqual([]);
  });

  it("skips must block when if.placeholderSatisfies has malformed constraint", async () => {
    const config: ConfigV1 = {
      version: "v1",
      conventions: [
        {
          name: "satisfies-rule",
          paths: "packages/{providerId}",
          must: [
            {
              if: { placeholderSatisfies: "providerId:matches(" },
              must: { haveType: "file" },
            },
          ],
        },
      ],
    };
    const fs = createMockFileSystem({
      globResults: new Map([["packages/*", ["packages/openai"]]]),
      directories: new Set(["packages/openai"]),
    });
    const { diagnostics } = await run({ config, fileSystem: fs });
    expect(diagnostics).toEqual([]);
  });

  it("supports template expansion in if.hasFile", async () => {
    const config: ConfigV1 = {
      version: "v1",
      conventions: [
        {
          name: "template-rule",
          paths: "src/{name}/index.ts",
          must: [
            {
              if: { hasFile: "${name}.test.ts" },
              must: { haveType: "directory" },
            },
          ],
        },
      ],
    };
    const fs = createMockFileSystem({
      globResults: new Map([["src/*/index.ts", ["src/utils/index.ts"]]]),
      files: new Set(["src/utils/index.ts", "src/utils/utils.test.ts"]),
    });
    const { diagnostics } = await run({ config, fileSystem: fs });
    expect(diagnostics).toHaveLength(1);
    expect(diagnostics[0].conventionName).toBe("template-rule");
  });

  it("evaluates value and type import conditions by original names", async () => {
    const config: ConfigV1 = {
      version: "v1",
      conventions: [
        {
          name: "import-name-conditions",
          paths: "src/index.ts",
          must: [
            {
              name: "value-import-match",
              if: {
                hasValueImport: { name: "sourceValue", from: "pkg" },
              },
              must: { haveType: "directory" },
            },
            {
              name: "type-import-match",
              if: { hasTypeImport: { name: "SourceType", from: "pkg" } },
              must: { haveType: "directory" },
            },
            {
              name: "local-alias-does-not-match",
              if: { hasValueImport: "localValue" },
              must: { haveType: "directory" },
            },
            {
              name: "wrong-import-kind-does-not-match",
              if: { hasValueImport: "SourceType" },
              must: { haveType: "directory" },
            },
          ],
        },
      ],
    };
    const fs = createMockFileSystem({
      globResults: new Map([["src/index.ts", ["src/index.ts"]]]),
      files: new Set(["src/index.ts"]),
      fileContents: new Map([
        [
          "src/index.ts",
          'import { sourceValue as localValue, type SourceType as LocalType } from "pkg";',
        ],
      ]),
    });

    const { diagnostics } = await run({ config, fileSystem: fs });

    expect(diagnostics.map((diagnostic) => diagnostic.conventionName)).toEqual([
      "value-import-match",
      "type-import-match",
    ]);
  });

  it("evaluates exact value and type import source conditions", async () => {
    const config: ConfigV1 = {
      version: "v1",
      conventions: [
        {
          name: "import-source-conditions",
          paths: "src/index.ts",
          must: [
            {
              name: "value-source-match",
              if: { hasValueImportFrom: "pkg" },
              must: { haveType: "directory" },
            },
            {
              name: "type-source-match",
              if: { hasTypeImportFrom: "pkg" },
              must: { haveType: "directory" },
            },
            {
              name: "side-effect-value-source-match",
              if: { hasValueImportFrom: "./setup" },
              must: { haveType: "directory" },
            },
            {
              name: "side-effect-type-source-does-not-match",
              if: { hasTypeImportFrom: "./setup" },
              must: { haveType: "directory" },
            },
            {
              name: "wildcard-is-not-a-selector",
              if: { hasValueImportFrom: "pkg/*" },
              must: { haveType: "directory" },
            },
          ],
        },
      ],
    };
    const fs = createMockFileSystem({
      globResults: new Map([["src/index.ts", ["src/index.ts"]]]),
      files: new Set(["src/index.ts"]),
      fileContents: new Map([
        [
          "src/index.ts",
          [
            'import { value, type ValueType } from "pkg";',
            'import "./setup";',
          ].join("\n"),
        ],
      ]),
    });

    const { diagnostics } = await run({ config, fileSystem: fs });

    expect(diagnostics.map((diagnostic) => diagnostic.conventionName)).toEqual([
      "value-source-match",
      "type-source-match",
      "side-effect-value-source-match",
    ]);
  });

  it("expands import condition templates and reuses the parsed file", async () => {
    const config: ConfigV1 = {
      version: "v1",
      conventions: [
        {
          name: "templated-import-conditions",
          paths: "src/{moduleName}.ts",
          must: [
            {
              if: {
                hasValueImport: {
                  name: "create${moduleName.toPascalCase()}",
                  from: "./${moduleName}",
                },
              },
              must: { exportConstants: ["missingValue"] },
            },
            {
              if: { hasTypeImportFrom: "./${moduleName}" },
              must: { exportConstants: ["missingType"] },
            },
          ],
        },
      ],
    };
    const fs = createMockFileSystem({
      globResults: new Map([["src/*.ts", ["src/client.ts"]]]),
      files: new Set(["src/client.ts"]),
      fileContents: new Map([
        [
          "src/client.ts",
          'import { createClient as createApiClient, type Client } from "./client";',
        ],
      ]),
    });
    const readSpy = vi.spyOn(fs, "readFile");

    const { diagnostics } = await run({ config, fileSystem: fs });

    expect(diagnostics).toHaveLength(2);
    expect(readSpy).toHaveBeenCalledTimes(1);
  });

  it("supports every condition at the top level and reuses parsed files", async () => {
    const conditions = createMatchingConditions();
    const config: ConfigV1 = {
      version: "v1",
      conventions: conditions.flatMap((condition, index) => [
        {
          name: `top-level-condition-${index}`,
          paths: "src/{moduleName}.ts",
          if: condition,
          must: { exportConstants: [`missing${index}`] },
        },
        {
          name: `top-level-negative-condition-${index}`,
          paths: "src/{moduleName}.ts",
          ifNot: condition,
          must: { exportConstants: [`missingNegative${index}`] },
        },
      ]),
    };
    const fs = createMockFileSystem({
      globResults: new Map([["src/*.ts", ["src/client.ts"]]]),
      files: new Set(["src/client.ts", "src/marker.ts"]),
      fileContents: new Map([
        [
          "src/client.ts",
          'import { createClient, type Client } from "./client";',
        ],
      ]),
    });
    const readSpy = vi.spyOn(fs, "readFile");

    const { diagnostics } = await run({ config, fileSystem: fs });

    expect(diagnostics).toHaveLength(conditions.length);
    expect(diagnostics.map((diagnostic) => diagnostic.conventionName)).toEqual(
      conditions.map((_, index) => `top-level-condition-${index}`)
    );
    expect(readSpy).toHaveBeenCalledTimes(1);
  });

  it("supports every condition through ifNot in nested blocks", async () => {
    const conditions = createMatchingConditions();
    const config: ConfigV1 = {
      version: "v1",
      conventions: [
        {
          name: "nested-conditions",
          paths: "src/{moduleName}.ts",
          must: conditions.flatMap((condition, index) => [
            {
              name: `positive-condition-${index}`,
              if: condition,
              must: { exportConstants: [`missing${index}`] },
            },
            {
              name: `negative-condition-${index}`,
              ifNot: condition,
              must: { exportConstants: [`missingNegative${index}`] },
            },
          ]),
        },
      ],
    };
    const fs = createMockFileSystem({
      globResults: new Map([["src/*.ts", ["src/client.ts"]]]),
      files: new Set(["src/client.ts", "src/marker.ts"]),
      fileContents: new Map([
        [
          "src/client.ts",
          'import { createClient, type Client } from "./client";',
        ],
      ]),
    });
    const readSpy = vi.spyOn(fs, "readFile");

    const { diagnostics } = await run({ config, fileSystem: fs });

    expect(diagnostics).toHaveLength(conditions.length);
    expect(diagnostics.map((diagnostic) => diagnostic.conventionName)).toEqual(
      conditions.map((_, index) => `positive-condition-${index}`)
    );
    expect(readSpy).toHaveBeenCalledTimes(1);
  });

  it("combines if and ifNot gates at the top level and in nested blocks", async () => {
    const config: ConfigV1 = {
      version: "v1",
      conventions: [
        {
          name: "top-level-runs",
          paths: "src/index.ts",
          if: { hasFile: "marker.ts" },
          ifNot: { hasFile: "skip.ts" },
          must: { haveType: "directory" },
        },
        {
          name: "top-level-skips",
          paths: "src/index.ts",
          if: { hasFile: "marker.ts" },
          ifNot: { hasFile: "marker.ts" },
          must: { haveType: "directory" },
        },
        {
          name: "nested-gates",
          paths: "src/index.ts",
          must: [
            {
              name: "nested-runs",
              if: { hasFile: "marker.ts" },
              ifNot: { hasFile: "skip.ts" },
              must: { haveType: "directory" },
            },
            {
              name: "nested-skips",
              if: { hasFile: "marker.ts" },
              ifNot: { hasFile: "marker.ts" },
              must: { haveType: "directory" },
            },
          ],
        },
      ],
    };
    const fs = createMockFileSystem({
      globResults: new Map([["src/index.ts", ["src/index.ts"]]]),
      files: new Set(["src/index.ts", "src/marker.ts"]),
    });

    const { diagnostics } = await run({ config, fileSystem: fs });

    expect(diagnostics.map((diagnostic) => diagnostic.conventionName)).toEqual([
      "top-level-runs",
      "nested-runs",
    ]);
  });

  it("exactly inverts non-matching placeholder and directory import conditions", async () => {
    const config: ConfigV1 = {
      version: "v1",
      conventions: [
        {
          name: "negative-edge-cases",
          paths: "src/module",
          ifNot: { placeholderSatisfies: "unknown:matches(" },
          must: [
            {
              ifNot: { hasValueImportFrom: "pkg" },
              must: { haveType: "file" },
            },
          ],
        },
      ],
    };
    const fs = createMockFileSystem({
      globResults: new Map([["src/module", ["src/module"]]]),
      directories: new Set(["src/module"]),
    });
    const readSpy = vi.spyOn(fs, "readFile");

    const { diagnostics } = await run({ config, fileSystem: fs });

    expect(diagnostics).toHaveLength(1);
    expect(diagnostics[0]?.conventionName).toBe("negative-edge-cases");
    expect(readSpy).not.toHaveBeenCalled();
  });

  it("skips import conditions when the matched path is a directory", async () => {
    const config: ConfigV1 = {
      version: "v1",
      conventions: [
        {
          name: "directory-import-condition",
          paths: "src/module",
          must: [
            {
              if: { hasValueImportFrom: "pkg" },
              must: { haveType: "file" },
            },
          ],
        },
      ],
    };
    const fs = createMockFileSystem({
      globResults: new Map([["src/module", ["src/module"]]]),
      directories: new Set(["src/module"]),
    });
    const readSpy = vi.spyOn(fs, "readFile");

    const { diagnostics } = await run({ config, fileSystem: fs });

    expect(diagnostics).toEqual([]);
    expect(readSpy).not.toHaveBeenCalled();
  });

  it("injects static placeholders into the predicate context", async () => {
    const config: ConfigV1 = {
      version: "v1",
      conventions: [
        {
          name: "static-placeholders",
          paths: "packages/openai/src/index.ts",
          placeholders: { providerId: "openai" },
          must: [
            {
              if: { hasFile: "${providerId}.test.ts" },
              must: { haveType: "directory" },
            },
          ],
        },
      ],
    };
    const fs = createMockFileSystem({
      globResults: new Map([
        ["packages/openai/src/index.ts", ["packages/openai/src/index.ts"]],
      ]),
      files: new Set([
        "packages/openai/src/index.ts",
        "packages/openai/src/openai.test.ts",
      ]),
    });
    const { diagnostics } = await run({ config, fileSystem: fs });
    expect(diagnostics).toHaveLength(1);
    expect(diagnostics[0].conventionName).toBe("static-placeholders");
  });

  it("iterates over for.files matches and evaluates predicates", async () => {
    const config: ConfigV1 = {
      version: "v1",
      conventions: [
        {
          name: "for-iteration",
          paths: "components/{name}",
          must: [
            {
              for: { files: "*.test.tsx" },
              must: { haveType: "file" },
            },
          ],
        },
      ],
    };
    const fs = createMockFileSystem({
      globResults: new Map([
        ["components/*", ["components/Button"]],
        ["components/Button/*.test.tsx", ["components/Button/Button.test.tsx"]],
      ]),
      directories: new Set(["components/Button"]),
      files: new Set(["components/Button/Button.test.tsx"]),
    });
    const { diagnostics, filesChecked } = await run({
      config,
      fileSystem: fs,
    });
    expect(diagnostics).toEqual([]);
    expect(filesChecked).toBe(2);
  });

  it("silently skips when for.files matches zero files", async () => {
    const config: ConfigV1 = {
      version: "v1",
      conventions: [
        {
          name: "for-skip",
          paths: "components/{name}",
          must: [
            {
              for: { files: "{storyFile}.stories.tsx" },
              must: { haveType: "directory" },
            },
          ],
        },
      ],
    };
    const fs = createMockFileSystem({
      globResults: new Map([
        ["components/*", ["components/Input"]],
        ["components/Input/*.stories.tsx", []],
      ]),
      directories: new Set(["components/Input"]),
    });
    const { diagnostics } = await run({ config, fileSystem: fs });
    expect(diagnostics).toEqual([]);
  });

  it("merges placeholders from for.files with parent placeholders", async () => {
    const config: ConfigV1 = {
      version: "v1",
      conventions: [
        {
          name: "for-placeholders",
          paths: "components/{name}",
          must: [
            {
              for: { files: "{storyFile}.stories.tsx" },
              must: { haveType: "file" },
            },
          ],
        },
      ],
    };
    const fs = createMockFileSystem({
      globResults: new Map([
        ["components/*", ["components/Button"]],
        [
          "components/Button/*.stories.tsx",
          ["components/Button/Button.stories.tsx"],
        ],
      ]),
      directories: new Set(["components/Button"]),
      files: new Set(["components/Button/Button.stories.tsx"]),
    });
    const { diagnostics } = await run({ config, fileSystem: fs });
    expect(diagnostics).toEqual([]);
  });

  it("parent placeholder values take precedence over for.files placeholders", async () => {
    const config: ConfigV1 = {
      version: "v1",
      conventions: [
        {
          name: "for-parent-precedence",
          paths: "components/{name}",
          must: [
            {
              for: { files: "{name}.test.tsx" },
              must: { haveType: "file" },
            },
          ],
        },
      ],
    };
    const fs = createMockFileSystem({
      globResults: new Map([
        ["components/*", ["components/Button"]],
        ["components/Button/*.test.tsx", ["components/Button/Button.test.tsx"]],
      ]),
      directories: new Set(["components/Button"]),
      files: new Set(["components/Button/Button.test.tsx"]),
    });
    const { diagnostics } = await run({ config, fileSystem: fs });
    expect(diagnostics).toEqual([]);
  });

  it("iterates over for.files array matches from multiple patterns", async () => {
    const config: ConfigV1 = {
      version: "v1",
      conventions: [
        {
          name: "for-array",
          paths: "components/{name}",
          must: [
            {
              for: { files: ["*.test.tsx", "*.spec.tsx"] },
              must: { haveType: "file" },
            },
          ],
        },
      ],
    };
    const fs = createMockFileSystem({
      globResults: new Map([
        ["components/*", ["components/Button"]],
        [
          "components/Button/*.spec.tsx,components/Button/*.test.tsx",
          [
            "components/Button/Button.test.tsx",
            "components/Button/Button.spec.tsx",
          ],
        ],
      ]),
      directories: new Set(["components/Button"]),
      files: new Set([
        "components/Button/Button.test.tsx",
        "components/Button/Button.spec.tsx",
      ]),
    });
    const { diagnostics } = await run({ config, fileSystem: fs });
    expect(diagnostics).toEqual([]);
  });

  it("reports diagnostics from for.files array when file type is wrong", async () => {
    const config: ConfigV1 = {
      version: "v1",
      conventions: [
        {
          name: "for-array-fail",
          paths: "components/{name}",
          must: [
            {
              for: { files: ["*.test.tsx", "*.spec.tsx"] },
              must: { haveType: "directory" },
            },
          ],
        },
      ],
    };
    const fs = createMockFileSystem({
      globResults: new Map([
        ["components/*", ["components/Button"]],
        [
          "components/Button/*.spec.tsx,components/Button/*.test.tsx",
          ["components/Button/Button.test.tsx"],
        ],
      ]),
      directories: new Set(["components/Button"]),
      files: new Set(["components/Button/Button.test.tsx"]),
    });
    const { diagnostics } = await run({ config, fileSystem: fs });
    expect(diagnostics).toHaveLength(1);
    expect(diagnostics[0].filePath).toBe("components/Button/Button.test.tsx");
  });

  it("evaluates if condition before for iteration", async () => {
    const config: ConfigV1 = {
      version: "v1",
      conventions: [
        {
          name: "if-and-for",
          paths: "components/{name}",
          must: [
            {
              if: { hasFile: "${name}.test.tsx" },
              for: { files: "${name}.test.tsx" },
              must: { haveType: "directory" },
            },
          ],
        },
      ],
    };
    const fsWithCondition = createMockFileSystem({
      globResults: new Map([
        ["components/*", ["components/Button"]],
        [
          "components/Button/Button.test.tsx",
          ["components/Button/Button.test.tsx"],
        ],
      ]),
      directories: new Set(["components/Button"]),
      files: new Set(["components/Button/Button.test.tsx"]),
    });
    const { diagnostics } = await run({ config, fileSystem: fsWithCondition });
    expect(diagnostics).toHaveLength(1);
    expect(diagnostics[0].message).toBe(
      "Expected a directory but found a file"
    );
  });

  it("skips for block when if condition is not met", async () => {
    const config: ConfigV1 = {
      version: "v1",
      conventions: [
        {
          name: "if-and-for-skip",
          paths: "components/{name}",
          must: [
            {
              if: { hasFile: "${name}.test.tsx" },
              for: { files: "${name}.test.tsx" },
              must: { haveType: "directory" },
            },
          ],
        },
      ],
    };
    const fs = createMockFileSystem({
      globResults: new Map([["components/*", ["components/Button"]]]),
      directories: new Set(["components/Button"]),
    });
    const { diagnostics } = await run({ config, fileSystem: fs });
    expect(diagnostics).toEqual([]);
  });

  it("evaluates multiple must blocks independently", async () => {
    const config: ConfigV1 = {
      version: "v1",
      conventions: [
        {
          name: "multi-block",
          paths: "src/**/*.ts",
          must: [
            { must: { haveType: "file" } },
            {
              if: { hasFile: "missing.ts" },
              must: { haveType: "directory" },
            },
          ],
        },
      ],
    };
    const fs = createMockFileSystem({
      globResults: new Map([["src/**/*.ts", ["src/a.ts"]]]),
      files: new Set(["src/a.ts"]),
    });
    const { diagnostics } = await run({ config, fileSystem: fs });
    expect(diagnostics).toEqual([]);
  });
});

describe("severity propagation", () => {
  it("produces warning diagnostics when convention severity is warning", async () => {
    const config: ConfigV1 = {
      version: "v1",
      conventions: [
        {
          name: "warn-rule",
          severity: "warning",
          paths: "src/**/*.ts",
          must: { haveType: "file" },
        },
      ],
    };
    const fs = createMockFileSystem({
      globResults: new Map([["src/**/*.ts", ["src/utils"]]]),
      directories: new Set(["src/utils"]),
    });
    const { diagnostics } = await run({ config, fileSystem: fs });
    expect(diagnostics).toHaveLength(1);
    expect(diagnostics[0].severity).toBe("warning");
  });

  it("defaults to error severity when convention omits severity", async () => {
    const config: ConfigV1 = {
      version: "v1",
      conventions: [
        {
          name: "error-rule",
          paths: "src/**/*.ts",
          must: { haveType: "file" },
        },
      ],
    };
    const fs = createMockFileSystem({
      globResults: new Map([["src/**/*.ts", ["src/utils"]]]),
      directories: new Set(["src/utils"]),
    });
    const { diagnostics } = await run({ config, fileSystem: fs });
    expect(diagnostics).toHaveLength(1);
    expect(diagnostics[0].severity).toBe("error");
  });

  it("produces mixed severities from different conventions", async () => {
    const config: ConfigV1 = {
      version: "v1",
      conventions: [
        {
          name: "error-rule",
          severity: "error",
          paths: "src/**/*.ts",
          must: { haveType: "file" },
        },
        {
          name: "warn-rule",
          severity: "warning",
          paths: "lib/**/*.ts",
          must: { haveType: "file" },
        },
      ],
    };
    const fs = createMockFileSystem({
      globResults: new Map([
        ["src/**/*.ts", ["src/dir"]],
        ["lib/**/*.ts", ["lib/dir"]],
      ]),
      directories: new Set(["src/dir", "lib/dir"]),
    });
    const { diagnostics } = await run({ config, fileSystem: fs });
    expect(diagnostics).toHaveLength(2);
    const severities = diagnostics.map((d) => d.severity).sort();
    expect(severities).toEqual(["error", "warning"]);
  });
});

describe("excludeFiles", () => {
  it("convention-level excludeFiles skips matching file", async () => {
    const config: ConfigV1 = {
      version: "v1",
      conventions: [
        {
          name: "source-files",
          paths: "src/**/*.ts",
          excludeFiles: ["src/internal.ts"],
          must: { haveType: "file" },
        },
      ],
    };
    const fs = createMockFileSystem({
      globResults: new Map([
        ["src/**/*.ts", ["src/internal.ts", "src/utils.ts"]],
      ]),
      directories: new Set(["src/internal.ts"]),
      files: new Set(["src/utils.ts"]),
    });
    const { diagnostics } = await run({ config, fileSystem: fs });
    expect(diagnostics).toEqual([]);
  });

  it("convention-level excludeFiles with a **/ prefixed pattern skips matching file (#57 regression)", async () => {
    const config: ConfigV1 = {
      version: "v1",
      conventions: [
        {
          name: "source-files",
          paths: "foo/**/*.ts",
          excludeFiles: ["**/__test-env-tdd-state.ts"],
          must: { haveType: "file" },
        },
      ],
    };
    const fs = createMockFileSystem({
      globResults: new Map([
        ["foo/**/*.ts", ["foo/__test-env-tdd-state.ts", "foo/utils.ts"]],
      ]),
      directories: new Set(["foo/__test-env-tdd-state.ts"]),
      files: new Set(["foo/utils.ts"]),
    });
    const { diagnostics } = await run({ config, fileSystem: fs });
    expect(diagnostics).toEqual([]);
  });

  it("convention-level excludeFiles does not skip non-matching file", async () => {
    const config: ConfigV1 = {
      version: "v1",
      conventions: [
        {
          name: "source-files",
          paths: "src/**/*.ts",
          excludeFiles: ["src/other.ts"],
          must: { haveType: "file" },
        },
      ],
    };
    const fs = createMockFileSystem({
      globResults: new Map([["src/**/*.ts", ["src/utils"]]]),
      directories: new Set(["src/utils"]),
    });
    const { diagnostics } = await run({ config, fileSystem: fs });
    expect(diagnostics).toHaveLength(1);
  });

  it("convention-level excludeFiles with template placeholder", async () => {
    const config: ConfigV1 = {
      version: "v1",
      conventions: [
        {
          name: "provider-files",
          paths: "packages/{name}/src/index.ts",
          excludeFiles: ["packages/${name}/src/index.ts"],
          must: { haveType: "directory" },
        },
      ],
    };
    const fs = createMockFileSystem({
      globResults: new Map([
        ["packages/*/src/index.ts", ["packages/openai/src/index.ts"]],
      ]),
      files: new Set(["packages/openai/src/index.ts"]),
    });
    const { diagnostics } = await run({ config, fileSystem: fs });
    expect(diagnostics).toEqual([]);
  });

  it("block-level excludeFiles without for skips matching file", async () => {
    const config: ConfigV1 = {
      version: "v1",
      conventions: [
        {
          name: "block-exclude",
          paths: "src/**/*.ts",
          must: [
            {
              excludeFiles: ["src/special.ts"],
              must: { haveType: "file" },
            },
          ],
        },
      ],
    };
    const fs = createMockFileSystem({
      globResults: new Map([["src/**/*.ts", ["src/special.ts"]]]),
      directories: new Set(["src/special.ts"]),
    });
    const { diagnostics } = await run({ config, fileSystem: fs });
    expect(diagnostics).toEqual([]);
  });

  it("block-level excludeFiles with for excludes specific iterated files", async () => {
    const config: ConfigV1 = {
      version: "v1",
      conventions: [
        {
          name: "for-exclude",
          paths: "components/{name}",
          must: [
            {
              for: { files: "*.ts" },
              excludeFiles: ["components/Button/helpers.ts"],
              must: { haveType: "directory" },
            },
          ],
        },
      ],
    };
    const fs = createMockFileSystem({
      globResults: new Map([
        ["components/*", ["components/Button"]],
        [
          "components/Button/*.ts",
          ["components/Button/helpers.ts", "components/Button/Button.ts"],
        ],
      ]),
      directories: new Set(["components/Button"]),
      files: new Set([
        "components/Button/helpers.ts",
        "components/Button/Button.ts",
      ]),
    });
    const { diagnostics } = await run({ config, fileSystem: fs });
    expect(diagnostics).toHaveLength(1);
    expect(diagnostics[0].filePath).toBe("components/Button/Button.ts");
  });

  it("block-level excludeFiles with for excludes by filename only", async () => {
    const config: ConfigV1 = {
      version: "v1",
      conventions: [
        {
          name: "for-exclude-filename",
          paths: "components/{name}",
          must: [
            {
              for: { files: "*.ts" },
              excludeFiles: ["helpers.ts"],
              must: { haveType: "directory" },
            },
          ],
        },
      ],
    };
    const fs = createMockFileSystem({
      globResults: new Map([
        ["components/*", ["components/Button"]],
        [
          "components/Button/*.ts",
          ["components/Button/helpers.ts", "components/Button/Button.ts"],
        ],
      ]),
      directories: new Set(["components/Button"]),
      files: new Set([
        "components/Button/helpers.ts",
        "components/Button/Button.ts",
      ]),
    });
    const { diagnostics } = await run({ config, fileSystem: fs });
    expect(diagnostics).toHaveLength(1);
    expect(diagnostics[0].filePath).toBe("components/Button/Button.ts");
  });

  it("block-level excludeFiles with for and template resolving to filename", async () => {
    const config: ConfigV1 = {
      version: "v1",
      conventions: [
        {
          name: "for-exclude-template",
          paths: "providers/{providerId}",
          must: [
            {
              for: { files: "${providerId}-{modelKind}-model.ts" },
              excludeFiles: ["${providerId}-video-model.ts"],
              must: { haveType: "directory" },
            },
          ],
        },
      ],
    };
    const fs = createMockFileSystem({
      globResults: new Map([
        ["providers/*", ["providers/openai"]],
        [
          "providers/openai/openai-*-model.ts",
          [
            "providers/openai/openai-chat-model.ts",
            "providers/openai/openai-video-model.ts",
          ],
        ],
      ]),
      directories: new Set(["providers/openai"]),
      files: new Set([
        "providers/openai/openai-chat-model.ts",
        "providers/openai/openai-video-model.ts",
      ]),
    });
    const { diagnostics } = await run({ config, fileSystem: fs });
    expect(diagnostics).toHaveLength(1);
    expect(diagnostics[0].filePath).toBe(
      "providers/openai/openai-chat-model.ts"
    );
  });

  it("block-level excludeFiles with if condition", async () => {
    const config: ConfigV1 = {
      version: "v1",
      conventions: [
        {
          name: "if-exclude",
          paths: "src/{name}/index.ts",
          must: [
            {
              if: { hasFile: "config.ts" },
              excludeFiles: ["src/auth/index.ts"],
              must: { haveType: "directory" },
            },
          ],
        },
      ],
    };
    const fs = createMockFileSystem({
      globResults: new Map([
        ["src/*/index.ts", ["src/auth/index.ts", "src/billing/index.ts"]],
      ]),
      files: new Set([
        "src/auth/index.ts",
        "src/auth/config.ts",
        "src/billing/index.ts",
        "src/billing/config.ts",
      ]),
    });
    const { diagnostics } = await run({ config, fileSystem: fs });
    expect(diagnostics).toHaveLength(1);
    expect(diagnostics[0].filePath).toBe("src/billing/index.ts");
  });

  it("block-level excludeFiles with if and for combined", async () => {
    const config: ConfigV1 = {
      version: "v1",
      conventions: [
        {
          name: "if-for-exclude",
          paths: "components/{name}",
          must: [
            {
              if: { hasFile: "${name}.test.tsx" },
              for: { files: "*.test.tsx" },
              excludeFiles: ["components/Button/Button.test.tsx"],
              must: { haveType: "directory" },
            },
          ],
        },
      ],
    };
    const fs = createMockFileSystem({
      globResults: new Map([
        ["components/*", ["components/Button"]],
        [
          "components/Button/*.test.tsx",
          [
            "components/Button/Button.test.tsx",
            "components/Button/utils.test.tsx",
          ],
        ],
      ]),
      directories: new Set(["components/Button"]),
      files: new Set([
        "components/Button/Button.test.tsx",
        "components/Button/utils.test.tsx",
      ]),
    });
    const { diagnostics } = await run({ config, fileSystem: fs });
    expect(diagnostics).toHaveLength(1);
    expect(diagnostics[0].filePath).toBe("components/Button/utils.test.tsx");
  });

  it("convention-level and block-level excludeFiles coexist", async () => {
    const config: ConfigV1 = {
      version: "v1",
      conventions: [
        {
          name: "coexist-exclude",
          paths: "src/**/*.ts",
          excludeFiles: ["src/a.ts"],
          must: [
            {
              excludeFiles: ["src/b.ts"],
              must: { haveType: "file" },
            },
          ],
        },
      ],
    };
    const fs = createMockFileSystem({
      globResults: new Map([
        ["src/**/*.ts", ["src/a.ts", "src/b.ts", "src/c.ts"]],
      ]),
      directories: new Set(["src/a.ts", "src/b.ts", "src/c.ts"]),
    });
    const { diagnostics } = await run({ config, fileSystem: fs });
    expect(diagnostics).toHaveLength(1);
    expect(diagnostics[0].filePath).toBe("src/c.ts");
  });
});

describe("must block name", () => {
  it("uses block-level name instead of convention-level name", async () => {
    const config: ConfigV1 = {
      version: "v1",
      conventions: [
        {
          name: "convention-name",
          paths: "src/**/*.ts",
          must: [
            {
              name: "block-name",
              must: { haveType: "file" },
            },
          ],
        },
      ],
    };
    const fs = createMockFileSystem({
      globResults: new Map([["src/**/*.ts", ["src/utils"]]]),
      directories: new Set(["src/utils"]),
    });
    const { diagnostics } = await run({ config, fileSystem: fs });
    expect(diagnostics).toHaveLength(1);
    expect(diagnostics[0].conventionName).toBe("block-name");
  });

  it("falls back to convention-level name when block has no name", async () => {
    const config: ConfigV1 = {
      version: "v1",
      conventions: [
        {
          name: "convention-name",
          paths: "src/**/*.ts",
          must: [
            {
              must: { haveType: "file" },
            },
          ],
        },
      ],
    };
    const fs = createMockFileSystem({
      globResults: new Map([["src/**/*.ts", ["src/utils"]]]),
      directories: new Set(["src/utils"]),
    });
    const { diagnostics } = await run({ config, fileSystem: fs });
    expect(diagnostics).toHaveLength(1);
    expect(diagnostics[0].conventionName).toBe("convention-name");
  });

  it("mixed blocks: some with name, some without", async () => {
    const config: ConfigV1 = {
      version: "v1",
      conventions: [
        {
          name: "convention-name",
          paths: "src/**/*.ts",
          must: [
            {
              name: "block-a",
              must: { haveType: "file" },
            },
            {
              must: { haveType: "directory" },
            },
          ],
        },
      ],
    };
    const fs = createMockFileSystem({
      globResults: new Map([["src/**/*.ts", ["src/utils"]]]),
      directories: new Set(["src/utils"]),
    });
    const { diagnostics } = await run({ config, fileSystem: fs });
    expect(diagnostics).toHaveLength(1);
    expect(diagnostics[0].conventionName).toBe("block-a");
    expect(diagnostics[0].message).toBe(
      "Expected a file but found a directory"
    );
  });
});

describe("caching behavior", () => {
  it("parses the same file only once across multiple conventions", async () => {
    const readFileSpy = vi.fn().mockReturnValue("export const x = 1;");
    const fs: FileSystem = {
      glob: vi.fn((patterns: string[]) => {
        const key = patterns.sort().join(",");
        const results = new Map<string, string[]>([
          ["src/shared.ts", ["src/shared.ts"]],
        ]);
        return Promise.resolve(results.get(key) ?? []);
      }),
      isDirectory: () => false,
      isFile: (p: string) => p === "src/shared.ts",
      fileExists: (p: string) => p === "src/shared.ts",
      readDir: () => [],
      readFile: readFileSpy,
    };
    const config: ConfigV1 = {
      version: "v1",
      conventions: [
        {
          name: "convention-a",
          paths: "src/shared.ts",
          must: { exportValues: [{ name: "x" }] },
        },
        {
          name: "convention-b",
          paths: "src/shared.ts",
          must: { exportValues: [{ name: "x" }] },
        },
      ],
    };
    await run({ config, fileSystem: fs });
    expect(readFileSpy).toHaveBeenCalledTimes(1);
  });

  it("parses the same file only once when referenced in for blocks", async () => {
    const readFileSpy = vi.fn().mockReturnValue("export const x = 1;");
    const fs: FileSystem = {
      glob: vi.fn((patterns: string[]) => {
        const key = patterns.sort().join(",");
        const results = new Map<string, string[]>([
          ["components/*", ["components/Button"]],
          ["components/Button/*.ts", ["components/Button/shared.ts"]],
        ]);
        return Promise.resolve(results.get(key) ?? []);
      }),
      isDirectory: (p: string) => p === "components/Button",
      isFile: (p: string) => p === "components/Button/shared.ts",
      fileExists: (p: string) =>
        p === "components/Button" || p === "components/Button/shared.ts",
      readDir: () => [],
      readFile: readFileSpy,
    };
    const config: ConfigV1 = {
      version: "v1",
      conventions: [
        {
          name: "convention-a",
          paths: "components/{name}",
          must: [
            {
              for: { files: "*.ts" },
              must: { exportValues: [{ name: "x" }] },
            },
            {
              for: { files: "*.ts" },
              must: { exportValues: [{ name: "x" }] },
            },
          ],
        },
      ],
    };
    await run({ config, fileSystem: fs });
    expect(readFileSpy).toHaveBeenCalledTimes(1);
  });
});
