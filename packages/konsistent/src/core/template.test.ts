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
      kebabToCamelMap,
      kebabToPascalMap,
      value,
    });
  }
  return result;
}

describe("resolveTemplate", () => {
  it("resolves ${name} with toString", () => {
    const result = resolveTemplate({
      placeholders: makePlaceholders({ map: { name: "openai" } }),
      template: "${name}.ts",
    });
    expect(result).toBe("openai.ts");
  });

  it("resolves ${name.toPascalCase()}", () => {
    const result = resolveTemplate({
      placeholders: makePlaceholders({ map: { name: "openai" } }),
      template: "${name.toPascalCase()}Provider.ts",
    });
    expect(result).toBe("OpenaiProvider.ts");
  });

  it("resolves ${name.toCamelCase()}", () => {
    const result = resolveTemplate({
      placeholders: makePlaceholders({ map: { name: "test-utils" } }),
      template: "${name.toCamelCase()}.ts",
    });
    expect(result).toBe("testUtils.ts");
  });

  it("resolves ${name.toKebabCase()}", () => {
    const result = resolveTemplate({
      placeholders: makePlaceholders({ map: { name: "testUtils" } }),
      template: "${name.toKebabCase()}-provider.ts",
    });
    expect(result).toBe("test-utils-provider.ts");
  });

  it("resolves ${name.toSnakeCase()}", () => {
    const result = resolveTemplate({
      placeholders: makePlaceholders({ map: { name: "test-utils" } }),
      template: "${name.toSnakeCase()}_config.ts",
    });
    expect(result).toBe("test_utils_config.ts");
  });

  it("resolves ${name.toConstantCase()}", () => {
    const result = resolveTemplate({
      placeholders: makePlaceholders({ map: { name: "test-utils" } }),
      template: "${name.toConstantCase()}_CONFIG.ts",
    });
    expect(result).toBe("TEST_UTILS_CONFIG.ts");
  });

  it("resolves ${name.toFlatCase()}", () => {
    const result = resolveTemplate({
      placeholders: makePlaceholders({ map: { name: "test-utils" } }),
      template: "${name.toFlatCase()}-config.ts",
    });
    expect(result).toBe("testutils-config.ts");
  });

  it("leaves unknown placeholder names unchanged", () => {
    const result = resolveTemplate({
      placeholders: makePlaceholders({ map: { name: "openai" } }),
      template: "${unknown}.ts",
    });
    expect(result).toBe("${unknown}.ts");
  });

  it("leaves unknown methods unchanged", () => {
    const result = resolveTemplate({
      placeholders: makePlaceholders({ map: { name: "openai" } }),
      template: "${name.toTitleCase()}.ts",
    });
    expect(result).toBe("${name.toTitleCase()}.ts");
  });

  it("resolves multiple placeholders in one template", () => {
    const result = resolveTemplate({
      placeholders: makePlaceholders({
        map: { name: "openai", scope: "core" },
      }),
      template: "${scope.toPascalCase()}${name.toPascalCase()}.ts",
    });
    expect(result).toBe("CoreOpenai.ts");
  });

  it("returns template as-is when no placeholders present", () => {
    const result = resolveTemplate({
      placeholders: makePlaceholders({ map: { name: "openai" } }),
      template: "index.ts",
    });
    expect(result).toBe("index.ts");
  });

  it("resolves toPascalCase using kebabToPascalMap", () => {
    const result = resolveTemplate({
      placeholders: makePlaceholders({
        kebabToPascalMap: { openai: "OpenAI" },
        map: { name: "openai" },
      }),
      template: "${name.toPascalCase()}Provider.ts",
    });
    expect(result).toBe("OpenAIProvider.ts");
  });

  it("resolves ${name.toNthSegment(0)}", () => {
    const result = resolveTemplate({
      placeholders: makePlaceholders({ map: { name: "openai-chat" } }),
      template: "${name.toNthSegment(0)}-provider.ts",
    });
    expect(result).toBe("openai-provider.ts");
  });

  it("resolves ${name.toNthSegment(1)}", () => {
    const result = resolveTemplate({
      placeholders: makePlaceholders({ map: { name: "openai-chat" } }),
      template: "${name.toNthSegment(1)}.ts",
    });
    expect(result).toBe("chat.ts");
  });

  it("resolves ${name.toNthSegmentPascalCase(0)}", () => {
    const result = resolveTemplate({
      placeholders: makePlaceholders({ map: { name: "openai-chat" } }),
      template: "${name.toNthSegmentPascalCase(0)}Provider.ts",
    });
    expect(result).toBe("OpenaiProvider.ts");
  });

  it("resolves ${name.toNthSegmentCamelCase(1)}", () => {
    const result = resolveTemplate({
      placeholders: makePlaceholders({ map: { name: "openai-Chat" } }),
      template: "create${name.toNthSegmentCamelCase(1)}.ts",
    });
    expect(result).toBe("createchat.ts");
  });

  it("resolves toNthSegment out of bounds to empty string", () => {
    const result = resolveTemplate({
      placeholders: makePlaceholders({ map: { name: "openai" } }),
      template: "${name.toNthSegment(5)}.ts",
    });
    expect(result).toBe(".ts");
  });

  it("resolves toNthSegmentPascalCase using kebabToPascalMap", () => {
    const result = resolveTemplate({
      placeholders: makePlaceholders({
        kebabToPascalMap: { openai: "OpenAI" },
        map: { name: "openai-chat" },
      }),
      template: "${name.toNthSegmentPascalCase(0)}Provider.ts",
    });
    expect(result).toBe("OpenAIProvider.ts");
  });

  it("resolves toCamelCase falling back to kebabToPascalMap", () => {
    const result = resolveTemplate({
      placeholders: makePlaceholders({
        kebabToPascalMap: { graphql: "GraphQL" },
        map: { name: "graphql" },
      }),
      template: "create${name.toPascalCase()}",
    });
    expect(result).toBe("createGraphQL");
  });

  it("resolves ${name.extract(regex)} to first capture group", () => {
    const result = resolveTemplate({
      placeholders: makePlaceholders({ map: { name: "openai" } }),
      template: "${name.extract(^([a-z]+)ai$)}-stem.ts",
    });
    expect(result).toBe("open-stem.ts");
  });

  it("resolves ${name.extract(regex)} to full match when no subgroups", () => {
    const result = resolveTemplate({
      placeholders: makePlaceholders({ map: { name: "openai" } }),
      template: "${name.extract(^[a-z]+ai$)}.ts",
    });
    expect(result).toBe("openai.ts");
  });

  it("resolves ${name.extract(regex)} to empty string when no match", () => {
    const result = resolveTemplate({
      placeholders: makePlaceholders({ map: { name: "google" } }),
      template: "${name.extract(^([a-z]+)ai$)}.ts",
    });
    expect(result).toBe(".ts");
  });

  it("preserves existing numeric-arg parsing", () => {
    const result = resolveTemplate({
      placeholders: makePlaceholders({ map: { name: "openai-chat" } }),
      template: "${name.toNthSegment(0)}-x.ts",
    });
    expect(result).toBe("openai-x.ts");
  });
});
