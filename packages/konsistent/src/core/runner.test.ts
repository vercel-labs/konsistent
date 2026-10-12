import { API } from "typescript/unstable/sync";
import { describe, expect, it, vi } from "vitest";
import type { ConfigV1, IfConditionV1 } from "../config/schema.js";
import { createTypeScriptSession } from "../typescript/native-session.js";
import { parseFileStructure } from "../typescript/parser.js";
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
    directoryExists: (p: string) => directories.has(p),
    fileExists: (p: string) => files.has(p) || directories.has(p),
    glob(patterns: string[]): Promise<string[]> {
      const key = patterns.sort().join(",");
      return Promise.resolve(globResults.get(key) ?? []);
    },
    isDirectory: (p: string) => directories.has(p),
    isFile: (p: string) => files.has(p),
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
        from: "./${moduleName}",
        name: "create${moduleName.toPascalCase()}",
      },
    },
    { hasValueImportFrom: "./${moduleName}" },
    { hasTypeImport: { name: "${moduleName.toPascalCase()}" } },
    { hasTypeImportFrom: "./${moduleName}" },
  ];
}

describe("run", () => {
  it("threads a borrowed session through conditions, nested files, and comparisons", async () => {
    const session = createTypeScriptSession();
    const close = vi.spyOn(session, "close");
    const updates = vi.spyOn(API.prototype, "updateSnapshot");
    const fs = createMockFileSystem({
      directories: new Set(["src"]),
      fileContents: new Map([
        [
          "src/value.ts",
          'import type { Foo } from "./missing"; export type Value = Array< Foo >; send("email", 1_000);',
        ],
      ]),
      files: new Set(["src/value.ts"]),
      globResults: new Map([
        ["src", ["src"]],
        ["src/*.ts", ["src/value.ts"]],
      ]),
    });
    const read = vi.spyOn(fs, "readFile");
    try {
      const result = await run({
        config: {
          conventions: [
            {
              must: [
                {
                  for: { files: "*.ts" },
                  if: { hasTypeImport: "Foo" },
                  must: {
                    callFunction: [{ arguments: ["'email'"], name: "send" }],
                    exportTypes: [{ name: "Value", type: "Array<Foo>" }],
                  },
                },
              ],
              paths: "src",
            },
          ],
          version: "v1",
        },
        fileSystem: fs,
        typescriptSession: session,
      });
      expect(result.diagnostics).toEqual([]);
      expect(read).toHaveBeenCalledTimes(1);
      expect(updates).toHaveBeenCalledTimes(4);
      expect(new Set(updates.mock.instances).size).toBe(1);
      expect(close).not.toHaveBeenCalled();
      expect(
        parseFileStructure({ session, source: "export const next = 1;" })
          .constants[0].name
      ).toBe("next");
    } finally {
      session.close();
      updates.mockRestore();
    }
  });

  it("closes its owned native process if reading a later file fails", async () => {
    const close = vi.spyOn(API.prototype, "close");
    const error = new Error("Read failed");
    const fs = createMockFileSystem({
      fileContents: new Map([["src/first.ts", "export const value = 1;"]]),
      files: new Set(["src/first.ts", "src/second.ts"]),
      globResults: new Map([["src/*.ts", ["src/first.ts", "src/second.ts"]]]),
    });
    vi.spyOn(fs, "readFile").mockImplementation((path) => {
      if (path === "src/second.ts") {
        throw error;
      }
      return "export const value = 1;";
    });
    try {
      await expect(
        run({
          config: {
            conventions: [
              { must: { exportValues: ["value"] }, paths: "src/*.ts" },
            ],
            version: "v1",
          },
          fileSystem: fs,
        })
      ).rejects.toThrow(error);
      expect(close).toHaveBeenCalledTimes(1);
    } finally {
      close.mockRestore();
    }
  });

  it("bounds ancestor conventions and nested file blocks to selected paths", async () => {
    const config: ConfigV1 = {
      conventions: [
        {
          must: [
            {
              for: { files: "${componentName}.test.tsx" },
              must: { exportValues: ["describe"] },
            },
          ],
          paths: "components/{componentName}",
        },
      ],
      version: "v1",
    };
    const fs = createMockFileSystem({
      directories: new Set(["components/Button", "components/Input"]),
      fileContents: new Map([
        ["components/Button/Button.test.tsx", "export const describe = true;"],
        ["components/Input/Input.test.tsx", "export const invalid = true;"],
      ]),
      files: new Set([
        "components/Button/Button.test.tsx",
        "components/Input/Input.test.tsx",
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
    const config: ConfigV1 = { conventions: [], version: "v1" };
    const { diagnostics, filesChecked } = await run({
      config,
      fileSystem: createMockFileSystem({}),
    });
    expect(diagnostics).toEqual([]);
    expect(filesChecked).toBe(0);
  });

  it("returns diagnostics when haveType fails", async () => {
    const config: ConfigV1 = {
      conventions: [
        {
          must: { haveType: "file" },
          name: "source-files",
          paths: "src/**/*.ts",
        },
      ],
      version: "v1",
    };
    const fs = createMockFileSystem({
      directories: new Set(["src/utils"]),
      globResults: new Map([["src/**/*.ts", ["src/utils"]]]),
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
      conventions: [
        {
          must: { haveType: "file" },
          paths: "src/**/*.ts",
        },
      ],
      version: "v1",
    };
    const fs = createMockFileSystem({
      files: new Set(["src/index.ts"]),
      globResults: new Map([["src/**/*.ts", ["src/index.ts"]]]),
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
      conventions: [
        {
          must: { haveType: "directory" },
          paths: "src/**",
        },
      ],
      version: "v1",
    };
    const fs = createMockFileSystem({
      directories: new Set(["src/components"]),
      globResults: new Map([["src/**", ["src/components"]]]),
    });
    const { diagnostics } = await run({ config, fileSystem: fs });
    expect(diagnostics).toEqual([]);
  });

  it("handles array paths", async () => {
    const config: ConfigV1 = {
      conventions: [
        {
          must: { haveType: "file" },
          paths: ["src/**/*.ts", "lib/**/*.ts"],
        },
      ],
      version: "v1",
    };
    const fs = createMockFileSystem({
      files: new Set(["src/a.ts", "lib/b.ts"]),
      globResults: new Map([
        ["lib/**/*.ts,src/**/*.ts", ["src/a.ts", "lib/b.ts"]],
      ]),
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
      conventions: [
        {
          must: {} as ConfigV1["conventions"][0]["must"],
          paths: "src/**",
        },
      ],
      version: "v1",
    };
    const fs = createMockFileSystem({
      files: new Set(["src/index.ts"]),
      globResults: new Map([["src/**", ["src/index.ts"]]]),
    });
    const { diagnostics } = await run({ config, fileSystem: fs });
    expect(diagnostics).toEqual([]);
  });

  it("reports diagnostics when mustNot scalar predicates pass", async () => {
    const config: ConfigV1 = {
      conventions: [
        {
          mustNot: { haveType: "file" },
          name: "not-files",
          paths: "src/**/*.ts",
        },
      ],
      version: "v1",
    };
    const fs = createMockFileSystem({
      files: new Set(["src/index.ts"]),
      globResults: new Map([["src/**/*.ts", ["src/index.ts"]]]),
    });
    const { diagnostics } = await run({ config, fileSystem: fs });
    expect(diagnostics).toHaveLength(1);
    expect(diagnostics[0].predicateName).toBe("mustNot.haveType");
    expect(diagnostics[0].message).toBe('Forbidden path type "file"');
    expect(diagnostics[0].conventionName).toBe("not-files");
  });

  it("returns no diagnostics when mustNot scalar predicates fail", async () => {
    const config: ConfigV1 = {
      conventions: [
        {
          mustNot: { haveType: "file" },
          paths: "src/**/*.ts",
        },
      ],
      version: "v1",
    };
    const fs = createMockFileSystem({
      directories: new Set(["src/utils"]),
      globResults: new Map([["src/**/*.ts", ["src/utils"]]]),
    });
    const { diagnostics } = await run({ config, fileSystem: fs });
    expect(diagnostics).toEqual([]);
  });

  it("negates list predicates per item", async () => {
    const config: ConfigV1 = {
      conventions: [
        {
          mustNot: { exportConstants: ["debug", "missing"] },
          paths: "src/module.ts",
        },
      ],
      version: "v1",
    };
    const fs = createMockFileSystem({
      fileContents: new Map([["src/module.ts", "export const debug = true;"]]),
      files: new Set(["src/module.ts"]),
      globResults: new Map([["src/module.ts", ["src/module.ts"]]]),
    });
    const { diagnostics } = await run({ config, fileSystem: fs });
    expect(diagnostics).toHaveLength(1);
    expect(diagnostics[0].predicateName).toBe("mustNot.exportConstants");
    expect(diagnostics[0].message).toBe('Forbidden constant export "debug"');
  });

  it("forbids exact import and export alias pairs", async () => {
    const config: ConfigV1 = {
      conventions: [
        {
          mustNot: {
            exportTypes: [{ alias: "PublicType", name: "SourceExportType" }],
            exportValues: [{ alias: "publicValue", name: "sourceExport" }],
            importTypes: [{ alias: "LocalType", name: "SourceType" }],
            importValues: [{ alias: "localValue", name: "sourceValue" }],
          },
          paths: "src/module.ts",
        },
      ],
      version: "v1",
    };
    const fs = createMockFileSystem({
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
      files: new Set(["src/module.ts"]),
      globResults: new Map([["src/module.ts", ["src/module.ts"]]]),
    });
    const { diagnostics } = await run({ config, fileSystem: fs });
    expect(diagnostics.map((diagnostic) => diagnostic.message).sort()).toEqual(
      [
        'Forbidden import "sourceValue" as "localValue"',
        'Forbidden type import "SourceType" as "LocalType"',
        'Forbidden export "sourceExport" as "publicValue"',
        'Forbidden type export "SourceExportType" as "PublicType"',
      ].sort()
    );
  });

  it("allows a different alias when mustNot configures an exact pair", async () => {
    const config: ConfigV1 = {
      conventions: [
        {
          mustNot: {
            exportTypes: [
              { alias: "BlockedExportType", name: "SourceExportType" },
            ],
            exportValues: [{ alias: "blockedExport", name: "sourceExport" }],
            importTypes: [{ alias: "BlockedType", name: "SourceType" }],
            importValues: [{ alias: "blockedValue", name: "sourceValue" }],
          },
          paths: "src/module.ts",
        },
      ],
      version: "v1",
    };
    const fs = createMockFileSystem({
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
      files: new Set(["src/module.ts"]),
      globResults: new Map([["src/module.ts", ["src/module.ts"]]]),
    });
    const { diagnostics } = await run({ config, fileSystem: fs });
    expect(diagnostics).toEqual([]);
  });

  it("forbids original names under any named alias when alias is omitted", async () => {
    const config: ConfigV1 = {
      conventions: [
        {
          mustNot: {
            exportTypes: ["SourceExportType"],
            exportValues: ["sourceExport"],
            importTypes: ["SourceType"],
            importValues: ["sourceValue"],
          },
          paths: "src/module.ts",
        },
      ],
      version: "v1",
    };
    const fs = createMockFileSystem({
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
      files: new Set(["src/module.ts"]),
      globResults: new Map([["src/module.ts", ["src/module.ts"]]]),
    });
    const { diagnostics } = await run({ config, fileSystem: fs });
    expect(diagnostics.map((diagnostic) => diagnostic.message).sort()).toEqual(
      [
        'Forbidden import "sourceValue"',
        'Forbidden type import "SourceType"',
        'Forbidden export "sourceExport"',
        'Forbidden type export "SourceExportType"',
      ].sort()
    );
  });

  it("forbids a constant matching a mustNot schema", async () => {
    const config: ConfigV1 = {
      conventions: [
        {
          mustNot: {
            exportConstants: [{ name: "debug", schema: { type: "boolean" } }],
          },
          paths: "src/module.ts",
        },
      ],
      version: "v1",
    };
    const fs = createMockFileSystem({
      fileContents: new Map([
        ["src/module.ts", "export const debug: boolean = true;"],
      ]),
      files: new Set(["src/module.ts"]),
      globResults: new Map([["src/module.ts", ["src/module.ts"]]]),
    });
    const { diagnostics } = await run({ config, fileSystem: fs });
    expect(diagnostics).toHaveLength(1);
    expect(diagnostics[0].predicateName).toBe("mustNot.exportConstants");
    expect(diagnostics[0].message).toBe('Forbidden constant export "debug"');
  });

  it("allows a mustNot constant with a different schema", async () => {
    const config: ConfigV1 = {
      conventions: [
        {
          mustNot: {
            exportConstants: [{ name: "debug", schema: { type: "boolean" } }],
          },
          paths: "src/module.ts",
        },
      ],
      version: "v1",
    };
    const fs = createMockFileSystem({
      fileContents: new Map([
        ["src/module.ts", 'export const debug: string = "true";'],
      ]),
      files: new Set(["src/module.ts"]),
      globResults: new Map([["src/module.ts", ["src/module.ts"]]]),
    });
    const { diagnostics } = await run({ config, fileSystem: fs });
    expect(diagnostics).toEqual([]);
  });

  it("forbids a constant matching a mustNot exact type", async () => {
    const config: ConfigV1 = {
      conventions: [
        {
          mustNot: {
            exportConstants: [{ name: "debug", type: "DebugSettings" }],
          },
          paths: "src/module.ts",
        },
      ],
      version: "v1",
    };
    const fs = createMockFileSystem({
      fileContents: new Map([
        [
          "src/module.ts",
          "export const debug: DebugSettings = { enabled: true };",
        ],
      ]),
      files: new Set(["src/module.ts"]),
      globResults: new Map([["src/module.ts", ["src/module.ts"]]]),
    });
    const { diagnostics } = await run({ config, fileSystem: fs });
    expect(diagnostics).toHaveLength(1);
    expect(diagnostics[0].predicateName).toBe("mustNot.exportConstants");
  });

  it("allows a mustNot constant with a different exact type", async () => {
    const config: ConfigV1 = {
      conventions: [
        {
          mustNot: {
            exportConstants: [{ name: "debug", type: "DebugSettings" }],
          },
          paths: "src/module.ts",
        },
      ],
      version: "v1",
    };
    const fs = createMockFileSystem({
      fileContents: new Map([
        [
          "src/module.ts",
          "export const debug: OtherSettings = { enabled: true };",
        ],
      ]),
      files: new Set(["src/module.ts"]),
      globResults: new Map([["src/module.ts", ["src/module.ts"]]]),
    });
    const { diagnostics } = await run({ config, fileSystem: fs });
    expect(diagnostics).toEqual([]);
  });

  it("forbids an exported type matching a mustNot schema", async () => {
    const config: ConfigV1 = {
      conventions: [
        {
          mustNot: {
            exportTypes: [
              {
                name: "DebugSettings",
                schema: {
                  properties: { enabled: { type: "boolean" } },
                  type: "object",
                },
              },
            ],
          },
          paths: "src/module.ts",
        },
      ],
      version: "v1",
    };
    const fs = createMockFileSystem({
      fileContents: new Map([
        ["src/module.ts", "export type DebugSettings = { enabled?: boolean };"],
      ]),
      files: new Set(["src/module.ts"]),
      globResults: new Map([["src/module.ts", ["src/module.ts"]]]),
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
      conventions: [
        {
          mustNot: {
            exportTypes: [
              {
                name: "DebugSettings",
                schema: {
                  properties: { enabled: { type: "boolean" } },
                  type: "object",
                },
              },
            ],
          },
          paths: "src/module.ts",
        },
      ],
      version: "v1",
    };
    const fs = createMockFileSystem({
      fileContents: new Map([
        ["src/module.ts", "export type DebugSettings = { enabled: boolean };"],
      ]),
      files: new Set(["src/module.ts"]),
      globResults: new Map([["src/module.ts", ["src/module.ts"]]]),
    });
    const { diagnostics } = await run({ config, fileSystem: fs });
    expect(diagnostics).toEqual([]);
  });

  it("forbids an exported type matching a mustNot exact type", async () => {
    const config: ConfigV1 = {
      conventions: [
        {
          mustNot: {
            exportTypes: [
              { name: "DebugSettings", type: "SharedSettings<'debug'>" },
            ],
          },
          paths: "src/module.ts",
        },
      ],
      version: "v1",
    };
    const fs = createMockFileSystem({
      fileContents: new Map([
        [
          "src/module.ts",
          "export type DebugSettings = SharedSettings<'debug'>;",
        ],
      ]),
      files: new Set(["src/module.ts"]),
      globResults: new Map([["src/module.ts", ["src/module.ts"]]]),
    });
    const { diagnostics } = await run({ config, fileSystem: fs });
    expect(diagnostics).toHaveLength(1);
    expect(diagnostics[0].predicateName).toBe("mustNot.exportTypes");
  });

  it("allows a mustNot exported type with a different exact type", async () => {
    const config: ConfigV1 = {
      conventions: [
        {
          mustNot: {
            exportTypes: [
              { name: "DebugSettings", type: "SharedSettings<'debug'>" },
            ],
          },
          paths: "src/module.ts",
        },
      ],
      version: "v1",
    };
    const fs = createMockFileSystem({
      fileContents: new Map([
        [
          "src/module.ts",
          "export type DebugSettings = SharedSettings<'public'>;",
        ],
      ]),
      files: new Set(["src/module.ts"]),
      globResults: new Map([["src/module.ts", ["src/module.ts"]]]),
    });
    const { diagnostics } = await run({ config, fileSystem: fs });
    expect(diagnostics).toEqual([]);
  });

  it("returns no diagnostics when mustNot importValuesFrom does not match a subpath", async () => {
    const config: ConfigV1 = {
      conventions: [
        {
          mustNot: { importValuesFrom: "package" },
          paths: "src/module.ts",
        },
      ],
      version: "v1",
    };
    const fs = createMockFileSystem({
      fileContents: new Map([
        ["src/module.ts", "import { value } from 'package/v4';"],
      ]),
      files: new Set(["src/module.ts"]),
      globResults: new Map([["src/module.ts", ["src/module.ts"]]]),
    });
    const { diagnostics } = await run({ config, fileSystem: fs });
    expect(diagnostics).toEqual([]);
  });

  it("reports diagnostics when mustNot importValuesFrom wildcard matches a subpath", async () => {
    const config: ConfigV1 = {
      conventions: [
        {
          mustNot: { importValuesFrom: "package/*" },
          paths: "src/module.ts",
        },
      ],
      version: "v1",
    };
    const fs = createMockFileSystem({
      fileContents: new Map([
        ["src/module.ts", "import { value } from 'package/v4';"],
      ]),
      files: new Set(["src/module.ts"]),
      globResults: new Map([["src/module.ts", ["src/module.ts"]]]),
    });
    const { diagnostics } = await run({ config, fileSystem: fs });
    expect(diagnostics).toHaveLength(1);
    expect(diagnostics[0].predicateName).toBe("mustNot.importValuesFrom");
    expect(diagnostics[0].message).toBe('Forbidden import from "package/*"');
  });

  it("reports diagnostics per matching mustNot importValuesFrom array item", async () => {
    const config: ConfigV1 = {
      conventions: [
        {
          mustNot: { importValuesFrom: ["react", "package/*", "never"] },
          paths: "src/module.ts",
        },
      ],
      version: "v1",
    };
    const fs = createMockFileSystem({
      fileContents: new Map([
        [
          "src/module.ts",
          [
            "import React from 'react';",
            "import { value } from 'package/v4';",
          ].join("\n"),
        ],
      ]),
      files: new Set(["src/module.ts"]),
      globResults: new Map([["src/module.ts", ["src/module.ts"]]]),
    });
    const { diagnostics } = await run({ config, fileSystem: fs });
    expect(diagnostics.map((d) => d.message)).toEqual([
      'Forbidden import from "react"',
      'Forbidden import from "package/*"',
    ]);
  });

  it("allows excluded value imports in a mustNot selector", async () => {
    const config: ConfigV1 = {
      conventions: [
        {
          mustNot: {
            importValuesFrom: [
              "@ai-sdk/*",
              "!@ai-sdk/harness",
              "!@ai-sdk/harness/*",
              "@ai-sdk/harness/bridge",
            ],
          },
          paths: "src/module.ts",
        },
      ],
      version: "v1",
    };
    const fs = createMockFileSystem({
      fileContents: new Map([
        [
          "src/module.ts",
          [
            "import { harness } from '@ai-sdk/harness';",
            "import { testing } from '@ai-sdk/harness/testing';",
          ].join("\n"),
        ],
      ]),
      files: new Set(["src/module.ts"]),
      globResults: new Map([["src/module.ts", ["src/module.ts"]]]),
    });

    const { diagnostics } = await run({ config, fileSystem: fs });
    expect(diagnostics).toEqual([]);
  });

  it("forbids selected and re-included value imports as one selector", async () => {
    const config: ConfigV1 = {
      conventions: [
        {
          mustNot: {
            importValuesFrom: [
              "@ai-sdk/*",
              "!@ai-sdk/harness",
              "!@ai-sdk/harness/*",
              "@ai-sdk/harness/bridge",
            ],
          },
          paths: "src/module.ts",
        },
      ],
      version: "v1",
    };
    const fs = createMockFileSystem({
      fileContents: new Map([
        [
          "src/module.ts",
          [
            "import { core } from '@ai-sdk/core';",
            "import { bridge } from '@ai-sdk/harness/bridge';",
          ].join("\n"),
        ],
      ]),
      files: new Set(["src/module.ts"]),
      globResults: new Map([["src/module.ts", ["src/module.ts"]]]),
    });

    const { diagnostics } = await run({ config, fileSystem: fs });
    expect(diagnostics).toHaveLength(1);
    expect(diagnostics[0].predicateName).toBe("mustNot.importValuesFrom");
    expect(diagnostics[0].message).toBe('Forbidden import from "@ai-sdk/*"');
  });

  it("groups type import selectors while keeping exact constraints additive", async () => {
    const config: ConfigV1 = {
      conventions: [
        {
          mustNot: {
            importTypesFrom: ["react", "@vendor/*", "!@vendor/allowed"],
          },
          paths: "src/module.ts",
        },
      ],
      version: "v1",
    };
    const fs = createMockFileSystem({
      fileContents: new Map([
        [
          "src/module.ts",
          [
            "import type { ReactNode } from 'react';",
            "import type { Tool } from '@vendor/project';",
          ].join("\n"),
        ],
      ]),
      files: new Set(["src/module.ts"]),
      globResults: new Map([["src/module.ts", ["src/module.ts"]]]),
    });

    const { diagnostics } = await run({ config, fileSystem: fs });
    expect(diagnostics.map((diagnostic) => diagnostic.message)).toEqual([
      'Forbidden type import from "react"',
      'Forbidden type import from "@vendor/*"',
    ]);
  });

  it("applies block metadata to mustNot predicates", async () => {
    const config: ConfigV1 = {
      conventions: [
        {
          must: [
            {
              excludeFiles: ["helpers.test.ts"],
              for: { files: "*.test.ts" },
              if: { hasFile: "${name}.test.ts" },
              mustNot: { exportConstants: ["debug"] },
              name: "no-debug-tests",
            },
          ],
          name: "components",
          paths: "components/{name}",
          severity: "warning",
        },
      ],
      version: "v1",
    };
    const fs = createMockFileSystem({
      directories: new Set(["components/Button"]),
      fileContents: new Map([
        ["components/Button/Button.test.ts", "export const debug = true;"],
        ["components/Button/helpers.test.ts", "export const debug = true;"],
      ]),
      files: new Set([
        "components/Button/Button.test.ts",
        "components/Button/helpers.test.ts",
      ]),
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
    });
    const { diagnostics } = await run({ config, fileSystem: fs });
    expect(diagnostics).toHaveLength(1);
    expect(diagnostics[0].filePath).toBe("components/Button/Button.test.ts");
    expect(diagnostics[0].conventionName).toBe("no-debug-tests");
    expect(diagnostics[0].severity).toBe("warning");
  });

  it("evaluates must block when if.hasFile condition is met", async () => {
    const config: ConfigV1 = {
      conventions: [
        {
          must: [
            {
              if: { hasFile: "schema.ts" },
              must: { haveType: "directory" },
            },
          ],
          name: "conditional-rule",
          paths: "src/**/*.ts",
        },
      ],
      version: "v1",
    };
    const fs = createMockFileSystem({
      files: new Set(["src/models/index.ts", "src/models/schema.ts"]),
      globResults: new Map([["src/**/*.ts", ["src/models/index.ts"]]]),
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
      conventions: [
        {
          if: { hasFile: "gate.ts" },
          must: [
            {
              if: { hasFile: "block-gate.ts" },
              must: { haveFiles: ["required.ts"] },
              name: "matching-block-condition",
            },
            {
              if: { hasFile: "absent.ts" },
              must: { haveFiles: ["also-required.ts"] },
              name: "non-matching-block-condition",
            },
            {
              mustNot: { haveType: "directory" },
              name: "gated-must-not",
            },
          ],
          name: "conditional-convention",
          paths: "packages/{packageName}",
        },
      ],
      version: "v1",
    };
    const fs = createMockFileSystem({
      directories: new Set(["packages/matching", "packages/non-matching"]),
      files: new Set([
        "packages/matching/gate.ts",
        "packages/matching/block-gate.ts",
        "packages/non-matching/block-gate.ts",
      ]),
      globResults: new Map([
        ["packages/*", ["packages/matching", "packages/non-matching"]],
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
      conventions: [
        {
          must: [
            {
              if: { hasFile: "schema.ts" },
              must: { haveType: "directory" },
            },
          ],
          name: "conditional-rule",
          paths: "src/**/*.ts",
        },
      ],
      version: "v1",
    };
    const fs = createMockFileSystem({
      files: new Set(["src/models/index.ts"]),
      globResults: new Map([["src/**/*.ts", ["src/models/index.ts"]]]),
    });
    const { diagnostics } = await run({ config, fileSystem: fs });
    expect(diagnostics).toEqual([]);
  });

  it("applies file patterns to positive and negative gates and forbidden files", async () => {
    const config: ConfigV1 = {
      conventions: [
        {
          must: [
            {
              if: { hasFile: "instructions.{md,ts}" },
              must: { haveFiles: ["root-only.ts"] },
            },
            {
              ifNot: { hasFile: "instructions.{md,ts}" },
              must: {
                haveFiles: ["instructions/*.{md,ts}", "metadata/*.json"],
              },
            },
            { mustNot: { haveFiles: ["secret/*.{md,ts}"] } },
          ],
          paths: "modules/{module}",
        },
      ],
      version: "v1",
    };
    const fs = createMockFileSystem({
      directories: new Set(["modules/root", "modules/nested"]),
      globResults: new Map([["modules/*", ["modules/root", "modules/nested"]]]),
    });
    const matchingPatterns = new Set([
      "modules/root/instructions.{md,ts}",
      "modules/root/root-only.ts",
      "modules/nested/instructions/*.{md,ts}",
      "modules/nested/secret/*.{md,ts}",
    ]);
    vi.spyOn(fs, "fileExists").mockImplementation((path) =>
      matchingPatterns.has(path)
    );

    const { diagnostics } = await run({ config, fileSystem: fs });
    expect(diagnostics.map((diagnostic) => diagnostic.message)).toEqual([
      "Missing required file: metadata/*.json",
      'Forbidden file "secret/*.{md,ts}"',
    ]);
    expect(
      diagnostics.every(
        (diagnostic) => diagnostic.filePath === "modules/nested"
      )
    ).toBe(true);
  });

  it("checks directory patterns in if, ifNot, must, and mustNot", async () => {
    const config: ConfigV1 = {
      conventions: [
        {
          must: [
            {
              if: { hasDirectory: "instructions.{md,ts}" },
              must: { haveDirectories: ["root-only"] },
            },
            {
              ifNot: { hasDirectory: "instructions.{md,ts}" },
              must: {
                haveDirectories: ["instructions/*.{md,ts}", "metadata/*"],
              },
            },
            {
              mustNot: { haveDirectories: ["secret/*", "forbidden/*"] },
            },
          ],
          paths: "modules/{module}",
        },
      ],
      version: "v1",
    };
    const fs = createMockFileSystem({
      directories: new Set(["modules/root", "modules/nested"]),
      globResults: new Map([["modules/*", ["modules/root", "modules/nested"]]]),
    });
    const matches = new Set([
      "modules/root/instructions.{md,ts}",
      "modules/root/root-only",
      "modules/nested/instructions/*.{md,ts}",
      "modules/nested/secret/*",
      "modules/nested/forbidden/*",
    ]);
    vi.spyOn(fs, "directoryExists").mockImplementation((path) =>
      matches.has(path)
    );

    const { diagnostics } = await run({ config, fileSystem: fs });
    expect(diagnostics.map((diagnostic) => diagnostic.message)).toEqual([
      "Missing required directory: metadata/*",
      'Forbidden directory "secret/*"',
      'Forbidden directory "forbidden/*"',
    ]);
    expect(diagnostics.every((d) => d.filePath === "modules/nested")).toBe(
      true
    );
  });

  it("evaluates must block unconditionally when no if is present", async () => {
    const config: ConfigV1 = {
      conventions: [
        {
          must: [{ must: { haveType: "file" } }],
          name: "unconditional-rule",
          paths: "src/**/*.ts",
        },
      ],
      version: "v1",
    };
    const fs = createMockFileSystem({
      directories: new Set(["src/utils"]),
      globResults: new Map([["src/**/*.ts", ["src/utils"]]]),
    });
    const { diagnostics } = await run({ config, fileSystem: fs });
    expect(diagnostics).toHaveLength(1);
    expect(diagnostics[0].message).toBe(
      "Expected a file but found a directory"
    );
  });

  it("evaluates must block when if.placeholderSatisfies is met", async () => {
    const config: ConfigV1 = {
      conventions: [
        {
          must: [
            {
              if: { placeholderSatisfies: "providerId:matches(^[a-z]+ai$)" },
              must: { haveType: "file" },
            },
          ],
          name: "satisfies-rule",
          paths: "packages/{providerId}",
        },
      ],
      version: "v1",
    };
    const fs = createMockFileSystem({
      directories: new Set(["packages/openai"]),
      globResults: new Map([["packages/*", ["packages/openai"]]]),
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
      conventions: [
        {
          must: [
            {
              if: { placeholderSatisfies: "providerId:matches(^[a-z]+ai$)" },
              must: { haveType: "file" },
            },
          ],
          name: "satisfies-rule",
          paths: "packages/{providerId}",
        },
      ],
      version: "v1",
    };
    const fs = createMockFileSystem({
      directories: new Set(["packages/google"]),
      globResults: new Map([["packages/*", ["packages/google"]]]),
    });
    const { diagnostics } = await run({ config, fileSystem: fs });
    expect(diagnostics).toEqual([]);
  });

  it("skips must block when if.placeholderSatisfies references unknown placeholder", async () => {
    const config: ConfigV1 = {
      conventions: [
        {
          must: [
            {
              if: { placeholderSatisfies: "typo:matches(^[a-z]+ai$)" },
              must: { haveType: "file" },
            },
          ],
          name: "satisfies-rule",
          paths: "packages/{providerId}",
        },
      ],
      version: "v1",
    };
    const fs = createMockFileSystem({
      directories: new Set(["packages/openai"]),
      globResults: new Map([["packages/*", ["packages/openai"]]]),
    });
    const { diagnostics } = await run({ config, fileSystem: fs });
    expect(diagnostics).toEqual([]);
  });

  it("skips must block when if.placeholderSatisfies has malformed constraint", async () => {
    const config: ConfigV1 = {
      conventions: [
        {
          must: [
            {
              if: { placeholderSatisfies: "providerId:matches(" },
              must: { haveType: "file" },
            },
          ],
          name: "satisfies-rule",
          paths: "packages/{providerId}",
        },
      ],
      version: "v1",
    };
    const fs = createMockFileSystem({
      directories: new Set(["packages/openai"]),
      globResults: new Map([["packages/*", ["packages/openai"]]]),
    });
    const { diagnostics } = await run({ config, fileSystem: fs });
    expect(diagnostics).toEqual([]);
  });

  it("supports template expansion in if.hasFile", async () => {
    const config: ConfigV1 = {
      conventions: [
        {
          must: [
            {
              if: { hasFile: "${name}.test.ts" },
              must: { haveType: "directory" },
            },
          ],
          name: "template-rule",
          paths: "src/{name}/index.ts",
        },
      ],
      version: "v1",
    };
    const fs = createMockFileSystem({
      files: new Set(["src/utils/index.ts", "src/utils/utils.test.ts"]),
      globResults: new Map([["src/*/index.ts", ["src/utils/index.ts"]]]),
    });
    const { diagnostics } = await run({ config, fileSystem: fs });
    expect(diagnostics).toHaveLength(1);
    expect(diagnostics[0].conventionName).toBe("template-rule");
  });

  it("evaluates value and type import conditions by original names", async () => {
    const config: ConfigV1 = {
      conventions: [
        {
          must: [
            {
              if: {
                hasValueImport: { from: "pkg", name: "sourceValue" },
              },
              must: { haveType: "directory" },
              name: "value-import-match",
            },
            {
              if: { hasTypeImport: { from: "pkg", name: "SourceType" } },
              must: { haveType: "directory" },
              name: "type-import-match",
            },
            {
              if: { hasValueImport: "localValue" },
              must: { haveType: "directory" },
              name: "local-alias-does-not-match",
            },
            {
              if: { hasValueImport: "SourceType" },
              must: { haveType: "directory" },
              name: "wrong-import-kind-does-not-match",
            },
          ],
          name: "import-name-conditions",
          paths: "src/index.ts",
        },
      ],
      version: "v1",
    };
    const fs = createMockFileSystem({
      fileContents: new Map([
        [
          "src/index.ts",
          'import { sourceValue as localValue, type SourceType as LocalType } from "pkg";',
        ],
      ]),
      files: new Set(["src/index.ts"]),
      globResults: new Map([["src/index.ts", ["src/index.ts"]]]),
    });

    const { diagnostics } = await run({ config, fileSystem: fs });

    expect(diagnostics.map((diagnostic) => diagnostic.conventionName)).toEqual([
      "value-import-match",
      "type-import-match",
    ]);
  });

  it("evaluates exact value and type import source conditions", async () => {
    const config: ConfigV1 = {
      conventions: [
        {
          must: [
            {
              if: { hasValueImportFrom: "pkg" },
              must: { haveType: "directory" },
              name: "value-source-match",
            },
            {
              if: { hasTypeImportFrom: "pkg" },
              must: { haveType: "directory" },
              name: "type-source-match",
            },
            {
              if: { hasValueImportFrom: "./setup" },
              must: { haveType: "directory" },
              name: "side-effect-value-source-match",
            },
            {
              if: { hasTypeImportFrom: "./setup" },
              must: { haveType: "directory" },
              name: "side-effect-type-source-does-not-match",
            },
            {
              if: { hasValueImportFrom: "pkg/*" },
              must: { haveType: "directory" },
              name: "wildcard-is-not-a-selector",
            },
          ],
          name: "import-source-conditions",
          paths: "src/index.ts",
        },
      ],
      version: "v1",
    };
    const fs = createMockFileSystem({
      fileContents: new Map([
        [
          "src/index.ts",
          [
            'import { value, type ValueType } from "pkg";',
            'import "./setup";',
          ].join("\n"),
        ],
      ]),
      files: new Set(["src/index.ts"]),
      globResults: new Map([["src/index.ts", ["src/index.ts"]]]),
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
      conventions: [
        {
          must: [
            {
              if: {
                hasValueImport: {
                  from: "./${moduleName}",
                  name: "create${moduleName.toPascalCase()}",
                },
              },
              must: { exportConstants: ["missingValue"] },
            },
            {
              if: { hasTypeImportFrom: "./${moduleName}" },
              must: { exportConstants: ["missingType"] },
            },
          ],
          name: "templated-import-conditions",
          paths: "src/{moduleName}.ts",
        },
      ],
      version: "v1",
    };
    const fs = createMockFileSystem({
      fileContents: new Map([
        [
          "src/client.ts",
          'import { createClient as createApiClient, type Client } from "./client";',
        ],
      ]),
      files: new Set(["src/client.ts"]),
      globResults: new Map([["src/*.ts", ["src/client.ts"]]]),
    });
    const readSpy = vi.spyOn(fs, "readFile");

    const { diagnostics } = await run({ config, fileSystem: fs });

    expect(diagnostics).toHaveLength(2);
    expect(readSpy).toHaveBeenCalledTimes(1);
  });

  it("supports every condition at the top level and reuses parsed files", async () => {
    const conditions = createMatchingConditions();
    const config: ConfigV1 = {
      conventions: conditions.flatMap((condition, index) => [
        {
          if: condition,
          must: { exportConstants: [`missing${index}`] },
          name: `top-level-condition-${index}`,
          paths: "src/{moduleName}.ts",
        },
        {
          ifNot: condition,
          must: { exportConstants: [`missingNegative${index}`] },
          name: `top-level-negative-condition-${index}`,
          paths: "src/{moduleName}.ts",
        },
      ]),
      version: "v1",
    };
    const fs = createMockFileSystem({
      fileContents: new Map([
        [
          "src/client.ts",
          'import { createClient, type Client } from "./client";',
        ],
      ]),
      files: new Set(["src/client.ts", "src/marker.ts"]),
      globResults: new Map([["src/*.ts", ["src/client.ts"]]]),
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
      conventions: [
        {
          must: conditions.flatMap((condition, index) => [
            {
              if: condition,
              must: { exportConstants: [`missing${index}`] },
              name: `positive-condition-${index}`,
            },
            {
              ifNot: condition,
              must: { exportConstants: [`missingNegative${index}`] },
              name: `negative-condition-${index}`,
            },
          ]),
          name: "nested-conditions",
          paths: "src/{moduleName}.ts",
        },
      ],
      version: "v1",
    };
    const fs = createMockFileSystem({
      fileContents: new Map([
        [
          "src/client.ts",
          'import { createClient, type Client } from "./client";',
        ],
      ]),
      files: new Set(["src/client.ts", "src/marker.ts"]),
      globResults: new Map([["src/*.ts", ["src/client.ts"]]]),
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
      conventions: [
        {
          if: { hasFile: "marker.ts" },
          ifNot: { hasFile: "skip.ts" },
          must: { haveType: "directory" },
          name: "top-level-runs",
          paths: "src/index.ts",
        },
        {
          if: { hasFile: "marker.ts" },
          ifNot: { hasFile: "marker.ts" },
          must: { haveType: "directory" },
          name: "top-level-skips",
          paths: "src/index.ts",
        },
        {
          must: [
            {
              if: { hasFile: "marker.ts" },
              ifNot: { hasFile: "skip.ts" },
              must: { haveType: "directory" },
              name: "nested-runs",
            },
            {
              if: { hasFile: "marker.ts" },
              ifNot: { hasFile: "marker.ts" },
              must: { haveType: "directory" },
              name: "nested-skips",
            },
          ],
          name: "nested-gates",
          paths: "src/index.ts",
        },
      ],
      version: "v1",
    };
    const fs = createMockFileSystem({
      files: new Set(["src/index.ts", "src/marker.ts"]),
      globResults: new Map([["src/index.ts", ["src/index.ts"]]]),
    });

    const { diagnostics } = await run({ config, fileSystem: fs });

    expect(diagnostics.map((diagnostic) => diagnostic.conventionName)).toEqual([
      "top-level-runs",
      "nested-runs",
    ]);
  });

  it("exactly inverts non-matching placeholder and directory import conditions", async () => {
    const config: ConfigV1 = {
      conventions: [
        {
          ifNot: { placeholderSatisfies: "unknown:matches(" },
          must: [
            {
              ifNot: { hasValueImportFrom: "pkg" },
              must: { haveType: "file" },
            },
          ],
          name: "negative-edge-cases",
          paths: "src/module",
        },
      ],
      version: "v1",
    };
    const fs = createMockFileSystem({
      directories: new Set(["src/module"]),
      globResults: new Map([["src/module", ["src/module"]]]),
    });
    const readSpy = vi.spyOn(fs, "readFile");

    const { diagnostics } = await run({ config, fileSystem: fs });

    expect(diagnostics).toHaveLength(1);
    expect(diagnostics[0]?.conventionName).toBe("negative-edge-cases");
    expect(readSpy).not.toHaveBeenCalled();
  });

  it("skips import conditions when the matched path is a directory", async () => {
    const config: ConfigV1 = {
      conventions: [
        {
          must: [
            {
              if: { hasValueImportFrom: "pkg" },
              must: { haveType: "file" },
            },
          ],
          name: "directory-import-condition",
          paths: "src/module",
        },
      ],
      version: "v1",
    };
    const fs = createMockFileSystem({
      directories: new Set(["src/module"]),
      globResults: new Map([["src/module", ["src/module"]]]),
    });
    const readSpy = vi.spyOn(fs, "readFile");

    const { diagnostics } = await run({ config, fileSystem: fs });

    expect(diagnostics).toEqual([]);
    expect(readSpy).not.toHaveBeenCalled();
  });

  it("injects static placeholders into the predicate context", async () => {
    const config: ConfigV1 = {
      conventions: [
        {
          must: [
            {
              if: { hasFile: "${providerId}.test.ts" },
              must: { haveType: "directory" },
            },
          ],
          name: "static-placeholders",
          paths: "packages/openai/src/index.ts",
          placeholders: { providerId: "openai" },
        },
      ],
      version: "v1",
    };
    const fs = createMockFileSystem({
      files: new Set([
        "packages/openai/src/index.ts",
        "packages/openai/src/openai.test.ts",
      ]),
      globResults: new Map([
        ["packages/openai/src/index.ts", ["packages/openai/src/index.ts"]],
      ]),
    });
    const { diagnostics } = await run({ config, fileSystem: fs });
    expect(diagnostics).toHaveLength(1);
    expect(diagnostics[0].conventionName).toBe("static-placeholders");
  });

  it("iterates over for.files matches and evaluates predicates", async () => {
    const config: ConfigV1 = {
      conventions: [
        {
          must: [
            {
              for: { files: "*.test.tsx" },
              must: { haveType: "file" },
            },
          ],
          name: "for-iteration",
          paths: "components/{name}",
        },
      ],
      version: "v1",
    };
    const fs = createMockFileSystem({
      directories: new Set(["components/Button"]),
      files: new Set(["components/Button/Button.test.tsx"]),
      globResults: new Map([
        ["components/*", ["components/Button"]],
        ["components/Button/*.test.tsx", ["components/Button/Button.test.tsx"]],
      ]),
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
      conventions: [
        {
          must: [
            {
              for: { files: "{storyFile}.stories.tsx" },
              must: { haveType: "directory" },
            },
          ],
          name: "for-skip",
          paths: "components/{name}",
        },
      ],
      version: "v1",
    };
    const fs = createMockFileSystem({
      directories: new Set(["components/Input"]),
      globResults: new Map([
        ["components/*", ["components/Input"]],
        ["components/Input/*.stories.tsx", []],
      ]),
    });
    const { diagnostics } = await run({ config, fileSystem: fs });
    expect(diagnostics).toEqual([]);
  });

  it("merges placeholders from for.files with parent placeholders", async () => {
    const config: ConfigV1 = {
      conventions: [
        {
          must: [
            {
              for: { files: "{storyFile}.stories.tsx" },
              must: { haveType: "file" },
            },
          ],
          name: "for-placeholders",
          paths: "components/{name}",
        },
      ],
      version: "v1",
    };
    const fs = createMockFileSystem({
      directories: new Set(["components/Button"]),
      files: new Set(["components/Button/Button.stories.tsx"]),
      globResults: new Map([
        ["components/*", ["components/Button"]],
        [
          "components/Button/*.stories.tsx",
          ["components/Button/Button.stories.tsx"],
        ],
      ]),
    });
    const { diagnostics } = await run({ config, fileSystem: fs });
    expect(diagnostics).toEqual([]);
  });

  it("parent placeholder values take precedence over for.files placeholders", async () => {
    const config: ConfigV1 = {
      conventions: [
        {
          must: [
            {
              for: { files: "{name}.test.tsx" },
              must: { haveType: "file" },
            },
          ],
          name: "for-parent-precedence",
          paths: "components/{name}",
        },
      ],
      version: "v1",
    };
    const fs = createMockFileSystem({
      directories: new Set(["components/Button"]),
      files: new Set(["components/Button/Button.test.tsx"]),
      globResults: new Map([
        ["components/*", ["components/Button"]],
        ["components/Button/*.test.tsx", ["components/Button/Button.test.tsx"]],
      ]),
    });
    const { diagnostics } = await run({ config, fileSystem: fs });
    expect(diagnostics).toEqual([]);
  });

  it("iterates over for.files array matches from multiple patterns", async () => {
    const config: ConfigV1 = {
      conventions: [
        {
          must: [
            {
              for: { files: ["*.test.tsx", "*.spec.tsx"] },
              must: { haveType: "file" },
            },
          ],
          name: "for-array",
          paths: "components/{name}",
        },
      ],
      version: "v1",
    };
    const fs = createMockFileSystem({
      directories: new Set(["components/Button"]),
      files: new Set([
        "components/Button/Button.test.tsx",
        "components/Button/Button.spec.tsx",
      ]),
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
    });
    const { diagnostics } = await run({ config, fileSystem: fs });
    expect(diagnostics).toEqual([]);
  });

  it("reports diagnostics from for.files array when file type is wrong", async () => {
    const config: ConfigV1 = {
      conventions: [
        {
          must: [
            {
              for: { files: ["*.test.tsx", "*.spec.tsx"] },
              must: { haveType: "directory" },
            },
          ],
          name: "for-array-fail",
          paths: "components/{name}",
        },
      ],
      version: "v1",
    };
    const fs = createMockFileSystem({
      directories: new Set(["components/Button"]),
      files: new Set(["components/Button/Button.test.tsx"]),
      globResults: new Map([
        ["components/*", ["components/Button"]],
        [
          "components/Button/*.spec.tsx,components/Button/*.test.tsx",
          ["components/Button/Button.test.tsx"],
        ],
      ]),
    });
    const { diagnostics } = await run({ config, fileSystem: fs });
    expect(diagnostics).toHaveLength(1);
    expect(diagnostics[0].filePath).toBe("components/Button/Button.test.tsx");
  });

  it("evaluates every if predicate against each for file", async () => {
    const matchingImport = {
      hasValueImport: { from: "./dependencies", name: "createClient" },
    } satisfies IfConditionV1;
    const conditions: Array<{
      name: string;
      condition: IfConditionV1;
    }> = [
      { condition: { hasFile: "marker.ts" }, name: "has-file" },
      {
        condition: { placeholderSatisfies: "variant:matches(^matching$)" },
        name: "placeholder-satisfies",
      },
      { condition: matchingImport, name: "has-value-import" },
      {
        condition: {
          hasTypeImport: { from: "./dependencies", name: "Client" },
        },
        name: "has-type-import",
      },
      {
        condition: { hasValueImportFrom: "./side-effect" },
        name: "has-value-import-from",
      },
      {
        condition: { hasTypeImportFrom: "./dependencies" },
        name: "has-type-import-from",
      },
    ];
    const config: ConfigV1 = {
      conventions: [
        {
          must: [
            ...conditions.map(({ name, condition }) => ({
              for: { files: "{variant}/*.ts" },
              if: condition,
              must: { haveType: "directory" },
              name,
            })),
            {
              for: { files: "{variant}/*.ts" },
              ifNot: matchingImport,
              must: { haveType: "directory" },
              name: "if-not",
            },
          ],
          name: "if-and-for",
          paths: "components/{name}",
        },
      ],
      version: "v1",
    };
    const fs = createMockFileSystem({
      directories: new Set([
        "components/Button",
        "components/Button/matching",
        "components/Button/skipped",
      ]),
      fileContents: new Map([
        [
          "components/Button/matching/matching.ts",
          [
            'import { createClient, type Client } from "./dependencies";',
            'import "./side-effect";',
          ].join("\n"),
        ],
      ]),
      files: new Set([
        "components/Button/matching/matching.ts",
        "components/Button/matching/marker.ts",
        "components/Button/skipped/skipped.ts",
      ]),
      globResults: new Map([
        ["components/*", ["components/Button"]],
        [
          "components/Button/*/*.ts",
          [
            "components/Button/matching/matching.ts",
            "components/Button/skipped/skipped.ts",
          ],
        ],
      ]),
    });
    const { diagnostics } = await run({ config, fileSystem: fs });
    expect(diagnostics).toHaveLength(7);
    expect(
      diagnostics.filter(
        (diagnostic) =>
          diagnostic.filePath === "components/Button/matching/matching.ts"
      )
    ).toHaveLength(6);
    expect(
      diagnostics.filter(
        (diagnostic) =>
          diagnostic.filePath === "components/Button/skipped/skipped.ts"
      )
    ).toHaveLength(1);
  });

  it("skips for block when if condition is not met", async () => {
    const config: ConfigV1 = {
      conventions: [
        {
          must: [
            {
              for: { files: "${name}.test.tsx" },
              if: { hasFile: "${name}.test.tsx" },
              must: { haveType: "directory" },
            },
          ],
          name: "if-and-for-skip",
          paths: "components/{name}",
        },
      ],
      version: "v1",
    };
    const fs = createMockFileSystem({
      directories: new Set(["components/Button"]),
      globResults: new Map([["components/*", ["components/Button"]]]),
    });
    const { diagnostics } = await run({ config, fileSystem: fs });
    expect(diagnostics).toEqual([]);
  });

  it("evaluates multiple must blocks independently", async () => {
    const config: ConfigV1 = {
      conventions: [
        {
          must: [
            { must: { haveType: "file" } },
            {
              if: { hasFile: "missing.ts" },
              must: { haveType: "directory" },
            },
          ],
          name: "multi-block",
          paths: "src/**/*.ts",
        },
      ],
      version: "v1",
    };
    const fs = createMockFileSystem({
      files: new Set(["src/a.ts"]),
      globResults: new Map([["src/**/*.ts", ["src/a.ts"]]]),
    });
    const { diagnostics } = await run({ config, fileSystem: fs });
    expect(diagnostics).toEqual([]);
  });
});

describe("severity propagation", () => {
  it("produces warning diagnostics when convention severity is warning", async () => {
    const config: ConfigV1 = {
      conventions: [
        {
          must: { haveType: "file" },
          name: "warn-rule",
          paths: "src/**/*.ts",
          severity: "warning",
        },
      ],
      version: "v1",
    };
    const fs = createMockFileSystem({
      directories: new Set(["src/utils"]),
      globResults: new Map([["src/**/*.ts", ["src/utils"]]]),
    });
    const { diagnostics } = await run({ config, fileSystem: fs });
    expect(diagnostics).toHaveLength(1);
    expect(diagnostics[0].severity).toBe("warning");
  });

  it("defaults to error severity when convention omits severity", async () => {
    const config: ConfigV1 = {
      conventions: [
        {
          must: { haveType: "file" },
          name: "error-rule",
          paths: "src/**/*.ts",
        },
      ],
      version: "v1",
    };
    const fs = createMockFileSystem({
      directories: new Set(["src/utils"]),
      globResults: new Map([["src/**/*.ts", ["src/utils"]]]),
    });
    const { diagnostics } = await run({ config, fileSystem: fs });
    expect(diagnostics).toHaveLength(1);
    expect(diagnostics[0].severity).toBe("error");
  });

  it("produces mixed severities from different conventions", async () => {
    const config: ConfigV1 = {
      conventions: [
        {
          must: { haveType: "file" },
          name: "error-rule",
          paths: "src/**/*.ts",
          severity: "error",
        },
        {
          must: { haveType: "file" },
          name: "warn-rule",
          paths: "lib/**/*.ts",
          severity: "warning",
        },
      ],
      version: "v1",
    };
    const fs = createMockFileSystem({
      directories: new Set(["src/dir", "lib/dir"]),
      globResults: new Map([
        ["src/**/*.ts", ["src/dir"]],
        ["lib/**/*.ts", ["lib/dir"]],
      ]),
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
      conventions: [
        {
          excludeFiles: ["src/internal.ts"],
          must: { haveType: "file" },
          name: "source-files",
          paths: "src/**/*.ts",
        },
      ],
      version: "v1",
    };
    const fs = createMockFileSystem({
      directories: new Set(["src/internal.ts"]),
      files: new Set(["src/utils.ts"]),
      globResults: new Map([
        ["src/**/*.ts", ["src/internal.ts", "src/utils.ts"]],
      ]),
    });
    const { diagnostics } = await run({ config, fileSystem: fs });
    expect(diagnostics).toEqual([]);
  });

  it("convention-level excludeFiles with a **/ prefixed pattern skips matching file (#57 regression)", async () => {
    const config: ConfigV1 = {
      conventions: [
        {
          excludeFiles: ["**/__test-env-tdd-state.ts"],
          must: { haveType: "file" },
          name: "source-files",
          paths: "foo/**/*.ts",
        },
      ],
      version: "v1",
    };
    const fs = createMockFileSystem({
      directories: new Set(["foo/__test-env-tdd-state.ts"]),
      files: new Set(["foo/utils.ts"]),
      globResults: new Map([
        ["foo/**/*.ts", ["foo/__test-env-tdd-state.ts", "foo/utils.ts"]],
      ]),
    });
    const { diagnostics } = await run({ config, fileSystem: fs });
    expect(diagnostics).toEqual([]);
  });

  it("convention-level excludeFiles does not skip non-matching file", async () => {
    const config: ConfigV1 = {
      conventions: [
        {
          excludeFiles: ["src/other.ts"],
          must: { haveType: "file" },
          name: "source-files",
          paths: "src/**/*.ts",
        },
      ],
      version: "v1",
    };
    const fs = createMockFileSystem({
      directories: new Set(["src/utils"]),
      globResults: new Map([["src/**/*.ts", ["src/utils"]]]),
    });
    const { diagnostics } = await run({ config, fileSystem: fs });
    expect(diagnostics).toHaveLength(1);
  });

  it("convention-level excludeFiles with template placeholder", async () => {
    const config: ConfigV1 = {
      conventions: [
        {
          excludeFiles: ["packages/${name}/src/index.ts"],
          must: { haveType: "directory" },
          name: "provider-files",
          paths: "packages/{name}/src/index.ts",
        },
      ],
      version: "v1",
    };
    const fs = createMockFileSystem({
      files: new Set(["packages/openai/src/index.ts"]),
      globResults: new Map([
        ["packages/*/src/index.ts", ["packages/openai/src/index.ts"]],
      ]),
    });
    const { diagnostics } = await run({ config, fileSystem: fs });
    expect(diagnostics).toEqual([]);
  });

  it("block-level excludeFiles without for skips matching file", async () => {
    const config: ConfigV1 = {
      conventions: [
        {
          must: [
            {
              excludeFiles: ["src/special.ts"],
              must: { haveType: "file" },
            },
          ],
          name: "block-exclude",
          paths: "src/**/*.ts",
        },
      ],
      version: "v1",
    };
    const fs = createMockFileSystem({
      directories: new Set(["src/special.ts"]),
      globResults: new Map([["src/**/*.ts", ["src/special.ts"]]]),
    });
    const { diagnostics } = await run({ config, fileSystem: fs });
    expect(diagnostics).toEqual([]);
  });

  it("block-level excludeFiles with for excludes specific iterated files", async () => {
    const config: ConfigV1 = {
      conventions: [
        {
          must: [
            {
              excludeFiles: ["components/Button/helpers.ts"],
              for: { files: "*.ts" },
              must: { haveType: "directory" },
            },
          ],
          name: "for-exclude",
          paths: "components/{name}",
        },
      ],
      version: "v1",
    };
    const fs = createMockFileSystem({
      directories: new Set(["components/Button"]),
      files: new Set([
        "components/Button/helpers.ts",
        "components/Button/Button.ts",
      ]),
      globResults: new Map([
        ["components/*", ["components/Button"]],
        [
          "components/Button/*.ts",
          ["components/Button/helpers.ts", "components/Button/Button.ts"],
        ],
      ]),
    });
    const { diagnostics } = await run({ config, fileSystem: fs });
    expect(diagnostics).toHaveLength(1);
    expect(diagnostics[0].filePath).toBe("components/Button/Button.ts");
  });

  it("block-level excludeFiles with for excludes by filename only", async () => {
    const config: ConfigV1 = {
      conventions: [
        {
          must: [
            {
              excludeFiles: ["helpers.ts"],
              for: { files: "*.ts" },
              must: { haveType: "directory" },
            },
          ],
          name: "for-exclude-filename",
          paths: "components/{name}",
        },
      ],
      version: "v1",
    };
    const fs = createMockFileSystem({
      directories: new Set(["components/Button"]),
      files: new Set([
        "components/Button/helpers.ts",
        "components/Button/Button.ts",
      ]),
      globResults: new Map([
        ["components/*", ["components/Button"]],
        [
          "components/Button/*.ts",
          ["components/Button/helpers.ts", "components/Button/Button.ts"],
        ],
      ]),
    });
    const { diagnostics } = await run({ config, fileSystem: fs });
    expect(diagnostics).toHaveLength(1);
    expect(diagnostics[0].filePath).toBe("components/Button/Button.ts");
  });

  it("block-level excludeFiles with for and template resolving to filename", async () => {
    const config: ConfigV1 = {
      conventions: [
        {
          must: [
            {
              excludeFiles: ["${providerId}-video-model.ts"],
              for: { files: "${providerId}-{modelKind}-model.ts" },
              must: { haveType: "directory" },
            },
          ],
          name: "for-exclude-template",
          paths: "providers/{providerId}",
        },
      ],
      version: "v1",
    };
    const fs = createMockFileSystem({
      directories: new Set(["providers/openai"]),
      files: new Set([
        "providers/openai/openai-chat-model.ts",
        "providers/openai/openai-video-model.ts",
      ]),
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
    });
    const { diagnostics } = await run({ config, fileSystem: fs });
    expect(diagnostics).toHaveLength(1);
    expect(diagnostics[0].filePath).toBe(
      "providers/openai/openai-chat-model.ts"
    );
  });

  it("block-level excludeFiles with if condition", async () => {
    const config: ConfigV1 = {
      conventions: [
        {
          must: [
            {
              excludeFiles: ["src/auth/index.ts"],
              if: { hasFile: "config.ts" },
              must: { haveType: "directory" },
            },
          ],
          name: "if-exclude",
          paths: "src/{name}/index.ts",
        },
      ],
      version: "v1",
    };
    const fs = createMockFileSystem({
      files: new Set([
        "src/auth/index.ts",
        "src/auth/config.ts",
        "src/billing/index.ts",
        "src/billing/config.ts",
      ]),
      globResults: new Map([
        ["src/*/index.ts", ["src/auth/index.ts", "src/billing/index.ts"]],
      ]),
    });
    const { diagnostics } = await run({ config, fileSystem: fs });
    expect(diagnostics).toHaveLength(1);
    expect(diagnostics[0].filePath).toBe("src/billing/index.ts");
  });

  it("block-level excludeFiles with if and for combined", async () => {
    const config: ConfigV1 = {
      conventions: [
        {
          must: [
            {
              excludeFiles: ["components/Button/Button.test.tsx"],
              for: { files: "*.test.tsx" },
              if: { hasFile: "${name}.test.tsx" },
              must: { haveType: "directory" },
            },
          ],
          name: "if-for-exclude",
          paths: "components/{name}",
        },
      ],
      version: "v1",
    };
    const fs = createMockFileSystem({
      directories: new Set(["components/Button"]),
      files: new Set([
        "components/Button/Button.test.tsx",
        "components/Button/utils.test.tsx",
      ]),
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
    });
    const { diagnostics } = await run({ config, fileSystem: fs });
    expect(diagnostics).toHaveLength(1);
    expect(diagnostics[0].filePath).toBe("components/Button/utils.test.tsx");
  });

  it("convention-level and block-level excludeFiles coexist", async () => {
    const config: ConfigV1 = {
      conventions: [
        {
          excludeFiles: ["src/a.ts"],
          must: [
            {
              excludeFiles: ["src/b.ts"],
              must: { haveType: "file" },
            },
          ],
          name: "coexist-exclude",
          paths: "src/**/*.ts",
        },
      ],
      version: "v1",
    };
    const fs = createMockFileSystem({
      directories: new Set(["src/a.ts", "src/b.ts", "src/c.ts"]),
      globResults: new Map([
        ["src/**/*.ts", ["src/a.ts", "src/b.ts", "src/c.ts"]],
      ]),
    });
    const { diagnostics } = await run({ config, fileSystem: fs });
    expect(diagnostics).toHaveLength(1);
    expect(diagnostics[0].filePath).toBe("src/c.ts");
  });
});

describe("must block name", () => {
  it("uses block-level name instead of convention-level name", async () => {
    const config: ConfigV1 = {
      conventions: [
        {
          must: [
            {
              must: { haveType: "file" },
              name: "block-name",
            },
          ],
          name: "convention-name",
          paths: "src/**/*.ts",
        },
      ],
      version: "v1",
    };
    const fs = createMockFileSystem({
      directories: new Set(["src/utils"]),
      globResults: new Map([["src/**/*.ts", ["src/utils"]]]),
    });
    const { diagnostics } = await run({ config, fileSystem: fs });
    expect(diagnostics).toHaveLength(1);
    expect(diagnostics[0].conventionName).toBe("block-name");
  });

  it("falls back to convention-level name when block has no name", async () => {
    const config: ConfigV1 = {
      conventions: [
        {
          must: [
            {
              must: { haveType: "file" },
            },
          ],
          name: "convention-name",
          paths: "src/**/*.ts",
        },
      ],
      version: "v1",
    };
    const fs = createMockFileSystem({
      directories: new Set(["src/utils"]),
      globResults: new Map([["src/**/*.ts", ["src/utils"]]]),
    });
    const { diagnostics } = await run({ config, fileSystem: fs });
    expect(diagnostics).toHaveLength(1);
    expect(diagnostics[0].conventionName).toBe("convention-name");
  });

  it("mixed blocks: some with name, some without", async () => {
    const config: ConfigV1 = {
      conventions: [
        {
          must: [
            {
              must: { haveType: "file" },
              name: "block-a",
            },
            {
              must: { haveType: "directory" },
            },
          ],
          name: "convention-name",
          paths: "src/**/*.ts",
        },
      ],
      version: "v1",
    };
    const fs = createMockFileSystem({
      directories: new Set(["src/utils"]),
      globResults: new Map([["src/**/*.ts", ["src/utils"]]]),
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
      directoryExists: () => false,
      fileExists: (p: string) => p === "src/shared.ts",
      glob: vi.fn((patterns: string[]) => {
        const key = patterns.sort().join(",");
        const results = new Map<string, string[]>([
          ["src/shared.ts", ["src/shared.ts"]],
        ]);
        return Promise.resolve(results.get(key) ?? []);
      }),
      isDirectory: () => false,
      isFile: (p: string) => p === "src/shared.ts",
      readDir: () => [],
      readFile: readFileSpy,
    };
    const config: ConfigV1 = {
      conventions: [
        {
          must: { exportValues: [{ name: "x" }] },
          name: "convention-a",
          paths: "src/shared.ts",
        },
        {
          must: { exportValues: [{ name: "x" }] },
          name: "convention-b",
          paths: "src/shared.ts",
        },
      ],
      version: "v1",
    };
    await run({ config, fileSystem: fs });
    expect(readFileSpy).toHaveBeenCalledTimes(1);
  });

  it("parses the same file only once when referenced in for blocks", async () => {
    const readFileSpy = vi.fn().mockReturnValue("export const x = 1;");
    const fs: FileSystem = {
      directoryExists: (p: string) => p === "components/Button",
      fileExists: (p: string) =>
        p === "components/Button" || p === "components/Button/shared.ts",
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
      readDir: () => [],
      readFile: readFileSpy,
    };
    const config: ConfigV1 = {
      conventions: [
        {
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
          name: "convention-a",
          paths: "components/{name}",
        },
      ],
      version: "v1",
    };
    await run({ config, fileSystem: fs });
    expect(readFileSpy).toHaveBeenCalledTimes(1);
  });
});
