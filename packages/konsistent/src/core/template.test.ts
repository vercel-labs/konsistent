import { describe, expect, it } from "vitest";
import { PlaceholderValue } from "./placeholder.js";
import { resolveTemplate } from "./template.js";

function makePlaceholders(opts: {
  map: Record<string, string>;
  kebabToPascalMap?: Record<string, string>;
  kebabToCamelMap?: Record<string, string>;
}): Record<string, PlaceholderValue> {
  const { map, kebabToPascalMap, kebabToCamelMap } = opts;
  const result: Record<string, PlaceholderValue> = {};
  for (const [key, value] of Object.entries(map)) {
    result[key] = new PlaceholderValue({
      value,
      kebabToPascalMap,
      kebabToCamelMap,
    });
  }
  return result;
}

describe("resolveTemplate", () => {
  it("resolves ${name} with toString", () => {
    const result = resolveTemplate({
      template: "${name}.ts",
      placeholders: makePlaceholders({ map: { name: "openai" } }),
    });
    expect(result).toBe("openai.ts");
  });

  it("resolves ${name.toPascalCase()}", () => {
    const result = resolveTemplate({
      template: "${name.toPascalCase()}Provider.ts",
      placeholders: makePlaceholders({ map: { name: "openai" } }),
    });
    expect(result).toBe("OpenaiProvider.ts");
  });

  it("resolves ${name.toCamelCase()}", () => {
    const result = resolveTemplate({
      template: "${name.toCamelCase()}.ts",
      placeholders: makePlaceholders({ map: { name: "test-utils" } }),
    });
    expect(result).toBe("testUtils.ts");
  });

  it("resolves ${name.toKebabCase()}", () => {
    const result = resolveTemplate({
      template: "${name.toKebabCase()}-provider.ts",
      placeholders: makePlaceholders({ map: { name: "testUtils" } }),
    });
    expect(result).toBe("test-utils-provider.ts");
  });

  it("resolves ${name.toSnakeCase()}", () => {
    const result = resolveTemplate({
      template: "${name.toSnakeCase()}_config.ts",
      placeholders: makePlaceholders({ map: { name: "test-utils" } }),
    });
    expect(result).toBe("test_utils_config.ts");
  });

  it("resolves ${name.toConstantCase()}", () => {
    const result = resolveTemplate({
      template: "${name.toConstantCase()}_CONFIG.ts",
      placeholders: makePlaceholders({ map: { name: "test-utils" } }),
    });
    expect(result).toBe("TEST_UTILS_CONFIG.ts");
  });

  it("resolves ${name.toFlatCase()}", () => {
    const result = resolveTemplate({
      template: "${name.toFlatCase()}-config.ts",
      placeholders: makePlaceholders({ map: { name: "test-utils" } }),
    });
    expect(result).toBe("testutils-config.ts");
  });

  it("leaves unknown placeholder names unchanged", () => {
    const result = resolveTemplate({
      template: "${unknown}.ts",
      placeholders: makePlaceholders({ map: { name: "openai" } }),
    });
    expect(result).toBe("${unknown}.ts");
  });

  it("leaves unknown methods unchanged", () => {
    const result = resolveTemplate({
      template: "${name.toTitleCase()}.ts",
      placeholders: makePlaceholders({ map: { name: "openai" } }),
    });
    expect(result).toBe("${name.toTitleCase()}.ts");
  });

  it("resolves multiple placeholders in one template", () => {
    const result = resolveTemplate({
      template: "${scope.toPascalCase()}${name.toPascalCase()}.ts",
      placeholders: makePlaceholders({
        map: { scope: "core", name: "openai" },
      }),
    });
    expect(result).toBe("CoreOpenai.ts");
  });

  it("returns template as-is when no placeholders present", () => {
    const result = resolveTemplate({
      template: "index.ts",
      placeholders: makePlaceholders({ map: { name: "openai" } }),
    });
    expect(result).toBe("index.ts");
  });

  it("resolves toPascalCase using kebabToPascalMap", () => {
    const result = resolveTemplate({
      template: "${name.toPascalCase()}Provider.ts",
      placeholders: makePlaceholders({
        map: { name: "openai" },
        kebabToPascalMap: { openai: "OpenAI" },
      }),
    });
    expect(result).toBe("OpenAIProvider.ts");
  });

  it("resolves ${name.toNthSegment(0)}", () => {
    const result = resolveTemplate({
      template: "${name.toNthSegment(0)}-provider.ts",
      placeholders: makePlaceholders({ map: { name: "openai-chat" } }),
    });
    expect(result).toBe("openai-provider.ts");
  });

  it("resolves ${name.toNthSegment(1)}", () => {
    const result = resolveTemplate({
      template: "${name.toNthSegment(1)}.ts",
      placeholders: makePlaceholders({ map: { name: "openai-chat" } }),
    });
    expect(result).toBe("chat.ts");
  });

  it("resolves ${name.toNthSegmentPascalCase(0)}", () => {
    const result = resolveTemplate({
      template: "${name.toNthSegmentPascalCase(0)}Provider.ts",
      placeholders: makePlaceholders({ map: { name: "openai-chat" } }),
    });
    expect(result).toBe("OpenaiProvider.ts");
  });

  it("resolves ${name.toNthSegmentCamelCase(1)}", () => {
    const result = resolveTemplate({
      template: "create${name.toNthSegmentCamelCase(1)}.ts",
      placeholders: makePlaceholders({ map: { name: "openai-Chat" } }),
    });
    expect(result).toBe("createchat.ts");
  });

  it("resolves toNthSegment out of bounds to empty string", () => {
    const result = resolveTemplate({
      template: "${name.toNthSegment(5)}.ts",
      placeholders: makePlaceholders({ map: { name: "openai" } }),
    });
    expect(result).toBe(".ts");
  });

  it("resolves toNthSegmentPascalCase using kebabToPascalMap", () => {
    const result = resolveTemplate({
      template: "${name.toNthSegmentPascalCase(0)}Provider.ts",
      placeholders: makePlaceholders({
        map: { name: "openai-chat" },
        kebabToPascalMap: { openai: "OpenAI" },
      }),
    });
    expect(result).toBe("OpenAIProvider.ts");
  });

  it("resolves toCamelCase falling back to kebabToPascalMap", () => {
    const result = resolveTemplate({
      template: "create${name.toPascalCase()}",
      placeholders: makePlaceholders({
        map: { name: "graphql" },
        kebabToPascalMap: { graphql: "GraphQL" },
      }),
    });
    expect(result).toBe("createGraphQL");
  });

  it("resolves ${name.extract(regex)} to first capture group", () => {
    const result = resolveTemplate({
      template: "${name.extract(^([a-z]+)ai$)}-stem.ts",
      placeholders: makePlaceholders({ map: { name: "openai" } }),
    });
    expect(result).toBe("open-stem.ts");
  });

  it("resolves ${name.extract(regex)} to full match when no subgroups", () => {
    const result = resolveTemplate({
      template: "${name.extract(^[a-z]+ai$)}.ts",
      placeholders: makePlaceholders({ map: { name: "openai" } }),
    });
    expect(result).toBe("openai.ts");
  });

  it("resolves ${name.extract(regex)} to empty string when no match", () => {
    const result = resolveTemplate({
      template: "${name.extract(^([a-z]+)ai$)}.ts",
      placeholders: makePlaceholders({ map: { name: "google" } }),
    });
    expect(result).toBe(".ts");
  });

  it("preserves existing numeric-arg parsing", () => {
    const result = resolveTemplate({
      template: "${name.toNthSegment(0)}-x.ts",
      placeholders: makePlaceholders({ map: { name: "openai-chat" } }),
    });
    expect(result).toBe("openai-x.ts");
  });
});
