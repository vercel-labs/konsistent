import { describe, expect, it, vi } from "vitest";
import type { ConfigV1 } from "../config/schema.js";
import type { FileSystem } from "./filesystem.js";
import { run } from "./runner.js";

function createMockFileSystem(opts: {
  globResults?: Map<string, string[]>;
  files?: Set<string>;
  directories?: Set<string>;
}): FileSystem {
  const globResults = opts.globResults ?? new Map<string, string[]>();
  const files = opts.files ?? new Set<string>();
  const directories = opts.directories ?? new Set<string>();
  return {
    glob(patterns: string[]): Promise<string[]> {
      const key = patterns.sort().join(",");
      return Promise.resolve(globResults.get(key) ?? []);
    },
    isDirectory: (p: string) => directories.has(p),
    isFile: (p: string) => files.has(p),
    fileExists: (p: string) => files.has(p) || directories.has(p),
    readDir: () => [],
    readFile: () => "",
  };
}

describe("run", () => {
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
    const { diagnostics } = await run({ config, fileSystem: fs });
    expect(diagnostics).toEqual([]);
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
          must: { export: [{ name: "x" }] },
        },
        {
          name: "convention-b",
          paths: "src/shared.ts",
          must: { export: [{ name: "x" }] },
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
              must: { export: [{ name: "x" }] },
            },
            {
              for: { files: "*.ts" },
              must: { export: [{ name: "x" }] },
            },
          ],
        },
      ],
    };
    await run({ config, fileSystem: fs });
    expect(readFileSpy).toHaveBeenCalledTimes(1);
  });
});
