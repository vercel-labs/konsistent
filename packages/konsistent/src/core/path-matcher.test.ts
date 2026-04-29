import { describe, expect, it } from "vitest";
import type { FileSystem } from "./filesystem.js";
import { hasPlaceholders, matchPaths, patternToGlob } from "./path-matcher.js";

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

describe("hasPlaceholders", () => {
  it("returns true for patterns with placeholders", () => {
    expect(hasPlaceholders("packages/{name}/src")).toBe(true);
  });

  it("returns false for patterns without placeholders", () => {
    expect(hasPlaceholders("packages/*/src")).toBe(false);
  });

  it("returns true for patterns with constrained placeholders", () => {
    expect(hasPlaceholders("packages/{name:segments(2)}/src")).toBe(true);
  });

  it("returns true for patterns with regex constraint args", () => {
    expect(hasPlaceholders("packages/{name:matches(^[a-z]+ai$)}/src")).toBe(
      true
    );
  });
});

describe("patternToGlob", () => {
  it("replaces placeholders with *", () => {
    expect(patternToGlob("packages/{name}/src")).toBe("packages/*/src");
  });

  it("replaces multiple placeholders", () => {
    expect(patternToGlob("{scope}/{name}/index.ts")).toBe("*/*/index.ts");
  });

  it("leaves non-placeholder patterns unchanged", () => {
    expect(patternToGlob("src/**/*.ts")).toBe("src/**/*.ts");
  });

  it("replaces constrained placeholders with *", () => {
    expect(patternToGlob("{name:segments(2)}/src")).toBe("*/src");
  });

  it("replaces placeholders with regex constraint args with *", () => {
    expect(patternToGlob("{name:matches(^[a-z]+ai$)}/src")).toBe("*/src");
  });
});

describe("matchPaths", () => {
  it("handles patterns without placeholders", async () => {
    const fs = createMockFileSystem({
      globResults: new Map([["src/**/*.ts", ["src/index.ts", "src/utils.ts"]]]),
    });
    const results = await matchPaths({
      patterns: ["src/**/*.ts"],
      fileSystem: fs,
    });
    expect(results).toHaveLength(2);
    expect(results[0].placeholders).toEqual({});
  });

  it("extracts single placeholder", async () => {
    const fs = createMockFileSystem({
      globResults: new Map([
        [
          "plugins/*/index.ts",
          ["plugins/auth/index.ts", "plugins/storage/index.ts"],
        ],
      ]),
    });
    const results = await matchPaths({
      patterns: ["plugins/{pluginName}/index.ts"],
      fileSystem: fs,
    });
    expect(results).toHaveLength(2);
    expect(results[0].placeholders.pluginName.toString()).toBe("auth");
    expect(results[1].placeholders.pluginName.toString()).toBe("storage");
  });

  it("extracts multiple placeholders", async () => {
    const fs = createMockFileSystem({
      globResults: new Map([["*/*/src", ["packages/openai/src"]]]),
    });
    const results = await matchPaths({
      patterns: ["{scope}/{name}/src"],
      fileSystem: fs,
    });
    expect(results).toHaveLength(1);
    expect(results[0].placeholders.scope.toString()).toBe("packages");
    expect(results[0].placeholders.name.toString()).toBe("openai");
  });

  it("rejects values with dots or special chars", async () => {
    const fs = createMockFileSystem({
      globResults: new Map([["plugins/*", ["plugins/auth.v2"]]]),
    });
    const results = await matchPaths({
      patterns: ["plugins/{name}"],
      fileSystem: fs,
    });
    expect(results).toHaveLength(0);
  });

  it("enforces multi-placeholder consistency", async () => {
    const fs = createMockFileSystem({
      globResults: new Map([["*/*", ["foo/bar"]]]),
    });
    const results = await matchPaths({
      patterns: ["{name}/{name}"],
      fileSystem: fs,
    });
    expect(results).toHaveLength(0);
  });

  it("allows consistent multi-placeholder values", async () => {
    const fs = createMockFileSystem({
      globResults: new Map([["*/*", ["auth/auth"]]]),
    });
    const results = await matchPaths({
      patterns: ["{name}/{name}"],
      fileSystem: fs,
    });
    expect(results).toHaveLength(1);
    expect(results[0].placeholders.name.toString()).toBe("auth");
  });

  it("negation filters out specific paths", async () => {
    const fs = createMockFileSystem({
      globResults: new Map([
        [
          "packages/*/src/index.ts",
          [
            "packages/cli/src/index.ts",
            "packages/core/src/index.ts",
            "packages/test-utils/src/index.ts",
          ],
        ],
        [
          "packages/test-utils/src/index.ts",
          ["packages/test-utils/src/index.ts"],
        ],
      ]),
    });
    const results = await matchPaths({
      patterns: [
        "packages/{packageName}/src/index.ts",
        "!packages/test-utils/src/index.ts",
      ],
      fileSystem: fs,
    });
    expect(results).toHaveLength(2);
    expect(results[0].path).toBe("packages/cli/src/index.ts");
    expect(results[1].path).toBe("packages/core/src/index.ts");
  });

  it("negation with placeholders resolves and excludes", async () => {
    const fs = createMockFileSystem({
      globResults: new Map([
        [
          "plugins/*/index.ts",
          [
            "plugins/auth/index.ts",
            "plugins/storage/index.ts",
            "plugins/debug/index.ts",
          ],
        ],
        ["plugins/debug/index.ts", ["plugins/debug/index.ts"]],
      ]),
    });
    const results = await matchPaths({
      patterns: [
        "plugins/{pluginName}/index.ts",
        "!plugins/{pluginName}/index.ts",
      ],
      fileSystem: fs,
    });
    expect(results).toHaveLength(0);
  });

  it("negation of directory excludes files within it", async () => {
    const fs = createMockFileSystem({
      globResults: new Map([
        [
          "packages/*/src/index.ts",
          [
            "packages/ai/src/index.ts",
            "packages/openai/src/index.ts",
            "packages/anthropic/src/index.ts",
          ],
        ],
        ["packages/ai", ["packages/ai"]],
      ]),
    });
    const results = await matchPaths({
      patterns: ["packages/{providerId}/src/index.ts", "!packages/ai"],
      fileSystem: fs,
    });
    expect(results).toHaveLength(2);
    expect(results[0].path).toBe("packages/openai/src/index.ts");
    expect(results[1].path).toBe("packages/anthropic/src/index.ts");
  });

  it("negation with no positive matches returns empty", async () => {
    const fs = createMockFileSystem({
      globResults: new Map([["src/nothing.ts", ["src/nothing.ts"]]]),
    });
    const results = await matchPaths({
      patterns: ["!src/nothing.ts"],
      fileSystem: fs,
    });
    expect(results).toHaveLength(0);
  });

  it("segments(1) constraint filters out multi-segment values", async () => {
    const fs = createMockFileSystem({
      globResults: new Map([
        [
          "src/openai-*-model.ts",
          [
            "src/openai-chat-model.ts",
            "src/openai-chat-language-model.ts",
            "src/openai-image-model.ts",
          ],
        ],
      ]),
    });
    const results = await matchPaths({
      patterns: ["src/openai-{modelKind:segments(1)}-model.ts"],
      fileSystem: fs,
    });
    expect(results).toHaveLength(2);
    expect(results[0].placeholders.modelKind.toString()).toBe("chat");
    expect(results[1].placeholders.modelKind.toString()).toBe("image");
  });

  it("segments(2) constraint filters out single-segment values", async () => {
    const fs = createMockFileSystem({
      globResults: new Map([
        [
          "src/openai-*-model.ts",
          [
            "src/openai-chat-model.ts",
            "src/openai-chat-language-model.ts",
            "src/openai-image-model.ts",
          ],
        ],
      ]),
    });
    const results = await matchPaths({
      patterns: ["src/openai-{modelKind:segments(2)}-model.ts"],
      fileSystem: fs,
    });
    expect(results).toHaveLength(1);
    expect(results[0].placeholders.modelKind.toString()).toBe("chat-language");
  });

  it("constraint on one placeholder does not affect others", async () => {
    const fs = createMockFileSystem({
      globResults: new Map([
        ["plugins/*/models/*", ["plugins/auth/models/user-role"]],
      ]),
    });
    const results = await matchPaths({
      patterns: ["plugins/{pluginName}/models/{modelName:segments(2)}"],
      fileSystem: fs,
    });
    expect(results).toHaveLength(1);
    expect(results[0].placeholders.pluginName.toString()).toBe("auth");
    expect(results[0].placeholders.modelName.toString()).toBe("user-role");
  });

  it("matches(regex) constraint filters values matching the regex", async () => {
    const fs = createMockFileSystem({
      globResults: new Map([
        [
          "packages/*",
          ["packages/openai", "packages/mistralai", "packages/google"],
        ],
      ]),
    });
    const results = await matchPaths({
      patterns: ["packages/{providerId:matches(^[a-z]+ai$)}"],
      fileSystem: fs,
    });
    expect(results).toHaveLength(2);
    expect(results[0].placeholders.providerId.toString()).toBe("openai");
    expect(results[1].placeholders.providerId.toString()).toBe("mistralai");
  });

  it("matches(regex) rejects values that do not match", async () => {
    const fs = createMockFileSystem({
      globResults: new Map([["packages/*", ["packages/google"]]]),
    });
    const results = await matchPaths({
      patterns: ["packages/{providerId:matches(^[a-z]+ai$)}"],
      fileSystem: fs,
    });
    expect(results).toHaveLength(0);
  });

  it("glob wildcard segment alongside constrained placeholder", async () => {
    const fs = createMockFileSystem({
      globResults: new Map([
        [
          "src/*/openai-*-model.ts",
          [
            "src/chat/openai-chat-model.ts",
            "src/responses/openai-responses-language-model.ts",
            "src/image/openai-image-model.ts",
          ],
        ],
      ]),
    });
    const seg1 = await matchPaths({
      patterns: ["src/*/openai-{modelKind:segments(1)}-model.ts"],
      fileSystem: fs,
    });
    expect(seg1).toHaveLength(2);
    expect(seg1[0].placeholders.modelKind.toString()).toBe("chat");
    expect(seg1[1].placeholders.modelKind.toString()).toBe("image");

    const seg2 = await matchPaths({
      patterns: ["src/*/openai-{modelKind:segments(2)}-model.ts"],
      fileSystem: fs,
    });
    expect(seg2).toHaveLength(1);
    expect(seg2[0].placeholders.modelKind.toString()).toBe(
      "responses-language"
    );
  });

  it("glob wildcard segment without placeholders still matches", async () => {
    const fs = createMockFileSystem({
      globResults: new Map([
        ["src/*/index.ts", ["src/utils/index.ts", "src/core/index.ts"]],
      ]),
    });
    const results = await matchPaths({
      patterns: ["src/*/index.ts"],
      fileSystem: fs,
    });
    expect(results).toHaveLength(2);
  });

  it("unconstrained placeholders still work normally", async () => {
    const fs = createMockFileSystem({
      globResults: new Map([
        [
          "src/openai-*-model.ts",
          ["src/openai-chat-model.ts", "src/openai-chat-language-model.ts"],
        ],
      ]),
    });
    const results = await matchPaths({
      patterns: ["src/openai-{modelKind}-model.ts"],
      fileSystem: fs,
    });
    expect(results).toHaveLength(2);
  });
});
