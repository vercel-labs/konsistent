import { describe, expect, it } from "vitest";
import { PlaceholderValue } from "./placeholder.js";

describe("PlaceholderValue", () => {
  describe("toString", () => {
    it("returns raw value", () => {
      expect(new PlaceholderValue({ value: "openai" }).toString()).toBe(
        "openai"
      );
    });

    it("preserves hyphens", () => {
      expect(new PlaceholderValue({ value: "test-utils" }).toString()).toBe(
        "test-utils"
      );
    });

    it("preserves underscores", () => {
      expect(new PlaceholderValue({ value: "test_utils" }).toString()).toBe(
        "test_utils"
      );
    });

    it("handles single character", () => {
      expect(new PlaceholderValue({ value: "a" }).toString()).toBe("a");
    });
  });

  describe("toPascalCase", () => {
    it("capitalizes single word", () => {
      expect(new PlaceholderValue({ value: "openai" }).toPascalCase()).toBe(
        "Openai"
      );
    });

    it("handles multi-word hyphenated", () => {
      expect(new PlaceholderValue({ value: "test-utils" }).toPascalCase()).toBe(
        "TestUtils"
      );
    });

    it("handles underscore-separated", () => {
      expect(new PlaceholderValue({ value: "test_utils" }).toPascalCase()).toBe(
        "TestUtils"
      );
    });

    it("handles camelCase input", () => {
      expect(new PlaceholderValue({ value: "testUtils" }).toPascalCase()).toBe(
        "TestUtils"
      );
    });

    it("handles single character", () => {
      expect(new PlaceholderValue({ value: "a" }).toPascalCase()).toBe("A");
    });

    it("handles multiple hyphens", () => {
      expect(
        new PlaceholderValue({ value: "my-test-utils" }).toPascalCase()
      ).toBe("MyTestUtils");
    });

    it("uses kebabToPascalMap when entry exists", () => {
      expect(
        new PlaceholderValue({
          kebabToPascalMap: { openai: "OpenAI" },
          value: "openai",
        }).toPascalCase()
      ).toBe("OpenAI");
    });

    it("falls back to default when kebabToPascalMap has no entry", () => {
      expect(
        new PlaceholderValue({
          kebabToPascalMap: { openai: "OpenAI" },
          value: "cache",
        }).toPascalCase()
      ).toBe("Cache");
    });

    it("uses camelToPascalMap when entry exists", () => {
      expect(
        new PlaceholderValue({
          camelToPascalMap: { openAI: "OpenAI" },
          value: "openAI",
        }).toPascalCase()
      ).toBe("OpenAI");
    });

    it("prefers kebabToPascalMap over camelToPascalMap", () => {
      expect(
        new PlaceholderValue({
          camelToPascalMap: { openai: "Openai" },
          kebabToPascalMap: { openai: "OpenAI" },
          value: "openai",
        }).toPascalCase()
      ).toBe("OpenAI");
    });

    it("falls back to default when camelToPascalMap has no entry", () => {
      expect(
        new PlaceholderValue({
          camelToPascalMap: { openAI: "OpenAI" },
          value: "testUtils",
        }).toPascalCase()
      ).toBe("TestUtils");
    });
  });

  describe("toCamelCase", () => {
    it("lowercases single word", () => {
      expect(new PlaceholderValue({ value: "Openai" }).toCamelCase()).toBe(
        "openai"
      );
    });

    it("handles multi-word hyphenated", () => {
      expect(new PlaceholderValue({ value: "test-utils" }).toCamelCase()).toBe(
        "testUtils"
      );
    });

    it("handles underscore-separated", () => {
      expect(new PlaceholderValue({ value: "test_utils" }).toCamelCase()).toBe(
        "testUtils"
      );
    });

    it("handles single character", () => {
      expect(new PlaceholderValue({ value: "A" }).toCamelCase()).toBe("a");
    });

    it("uses kebabToCamelMap when entry exists", () => {
      expect(
        new PlaceholderValue({
          kebabToCamelMap: { openai: "openAI" },
          value: "openai",
        }).toCamelCase()
      ).toBe("openAI");
    });

    it("falls back to kebabToPascalMap with lowercased first char", () => {
      expect(
        new PlaceholderValue({
          kebabToPascalMap: { graphql: "GraphQL" },
          value: "graphql",
        }).toCamelCase()
      ).toBe("graphQL");
    });

    it("prefers kebabToCamelMap over kebabToPascalMap", () => {
      expect(
        new PlaceholderValue({
          kebabToCamelMap: { openai: "openAI" },
          kebabToPascalMap: { openai: "OpenAI" },
          value: "openai",
        }).toCamelCase()
      ).toBe("openAI");
    });

    it("falls back to default when no map entry exists", () => {
      expect(
        new PlaceholderValue({
          kebabToPascalMap: { openai: "OpenAI" },
          value: "cache",
        }).toCamelCase()
      ).toBe("cache");
    });

    it("uses pascalToCamelMap when entry exists", () => {
      expect(
        new PlaceholderValue({
          pascalToCamelMap: { OpenAI: "openAI" },
          value: "OpenAI",
        }).toCamelCase()
      ).toBe("openAI");
    });

    it("prefers kebabToCamelMap over pascalToCamelMap", () => {
      expect(
        new PlaceholderValue({
          kebabToCamelMap: { openai: "openAI" },
          pascalToCamelMap: { openai: "openai" },
          value: "openai",
        }).toCamelCase()
      ).toBe("openAI");
    });

    it("falls back to default when pascalToCamelMap has no entry", () => {
      expect(
        new PlaceholderValue({
          pascalToCamelMap: { OpenAI: "openAI" },
          value: "TestUtils",
        }).toCamelCase()
      ).toBe("testUtils");
    });
  });

  describe("toKebabCase", () => {
    it("lowercases single word", () => {
      expect(new PlaceholderValue({ value: "Openai" }).toKebabCase()).toBe(
        "openai"
      );
    });

    it("preserves already kebab-case", () => {
      expect(new PlaceholderValue({ value: "test-utils" }).toKebabCase()).toBe(
        "test-utils"
      );
    });

    it("converts camelCase", () => {
      expect(new PlaceholderValue({ value: "testUtils" }).toKebabCase()).toBe(
        "test-utils"
      );
    });

    it("converts underscores", () => {
      expect(new PlaceholderValue({ value: "test_utils" }).toKebabCase()).toBe(
        "test-utils"
      );
    });

    it("uses pascalToKebabMap when entry exists", () => {
      expect(
        new PlaceholderValue({
          pascalToKebabMap: { OpenAI: "openai" },
          value: "OpenAI",
        }).toKebabCase()
      ).toBe("openai");
    });

    it("uses camelToKebabMap when entry exists", () => {
      expect(
        new PlaceholderValue({
          camelToKebabMap: { openAI: "openai" },
          value: "openAI",
        }).toKebabCase()
      ).toBe("openai");
    });

    it("prefers pascalToKebabMap over camelToKebabMap", () => {
      expect(
        new PlaceholderValue({
          camelToKebabMap: { OpenAI: "open-ai" },
          pascalToKebabMap: { OpenAI: "openai" },
          value: "OpenAI",
        }).toKebabCase()
      ).toBe("openai");
    });

    it("falls back to default when no map entry exists", () => {
      expect(
        new PlaceholderValue({
          pascalToKebabMap: { OpenAI: "openai" },
          value: "cache",
        }).toKebabCase()
      ).toBe("cache");
    });
  });

  describe("toFlatCase", () => {
    it("lowercases single word", () => {
      expect(new PlaceholderValue({ value: "openai" }).toFlatCase()).toBe(
        "openai"
      );
    });

    it("strips hyphens and lowercases", () => {
      expect(new PlaceholderValue({ value: "test-utils" }).toFlatCase()).toBe(
        "testutils"
      );
    });

    it("strips underscores and lowercases", () => {
      expect(new PlaceholderValue({ value: "test_utils" }).toFlatCase()).toBe(
        "testutils"
      );
    });

    it("handles camelCase input", () => {
      expect(new PlaceholderValue({ value: "testUtils" }).toFlatCase()).toBe(
        "testutils"
      );
    });

    it("handles PascalCase input", () => {
      expect(new PlaceholderValue({ value: "TestUtils" }).toFlatCase()).toBe(
        "testutils"
      );
    });

    it("handles single character", () => {
      expect(new PlaceholderValue({ value: "A" }).toFlatCase()).toBe("a");
    });
  });

  describe("toNthSegment", () => {
    it("returns first segment of hyphenated value", () => {
      expect(
        new PlaceholderValue({ value: "foo-bar-baz" }).toNthSegment(0)
      ).toBe("foo");
    });

    it("returns second segment", () => {
      expect(
        new PlaceholderValue({ value: "foo-bar-baz" }).toNthSegment(1)
      ).toBe("bar");
    });

    it("returns last segment", () => {
      expect(
        new PlaceholderValue({ value: "foo-bar-baz" }).toNthSegment(2)
      ).toBe("baz");
    });

    it("returns empty string when index out of bounds", () => {
      expect(new PlaceholderValue({ value: "foo-bar" }).toNthSegment(5)).toBe(
        ""
      );
    });

    it("returns whole value when no hyphens and index is 0", () => {
      expect(new PlaceholderValue({ value: "openai" }).toNthSegment(0)).toBe(
        "openai"
      );
    });

    it("returns empty string when no hyphens and index is 1", () => {
      expect(new PlaceholderValue({ value: "openai" }).toNthSegment(1)).toBe(
        ""
      );
    });
  });

  describe("toNthSegmentPascalCase", () => {
    it("capitalizes segment", () => {
      expect(
        new PlaceholderValue({ value: "foo-bar" }).toNthSegmentPascalCase(0)
      ).toBe("Foo");
    });

    it("capitalizes second segment", () => {
      expect(
        new PlaceholderValue({ value: "foo-bar" }).toNthSegmentPascalCase(1)
      ).toBe("Bar");
    });

    it("uses kebabToPascalMap when entry exists", () => {
      expect(
        new PlaceholderValue({
          kebabToPascalMap: { openai: "OpenAI" },
          value: "openai-graphql",
        }).toNthSegmentPascalCase(0)
      ).toBe("OpenAI");
    });

    it("falls back to default when no map entry", () => {
      expect(
        new PlaceholderValue({
          kebabToPascalMap: { graphql: "GraphQL" },
          value: "openai-graphql",
        }).toNthSegmentPascalCase(0)
      ).toBe("Openai");
    });

    it("returns empty string when out of bounds", () => {
      expect(
        new PlaceholderValue({ value: "foo-bar" }).toNthSegmentPascalCase(5)
      ).toBe("");
    });
  });

  describe("toNthSegmentCamelCase", () => {
    it("lowercases single-word segment", () => {
      expect(
        new PlaceholderValue({ value: "Foo-bar" }).toNthSegmentCamelCase(0)
      ).toBe("foo");
    });

    it("uses kebabToCamelMap when entry exists", () => {
      expect(
        new PlaceholderValue({
          kebabToCamelMap: { openai: "openAI" },
          value: "openai-graphql",
        }).toNthSegmentCamelCase(0)
      ).toBe("openAI");
    });

    it("falls back to kebabToPascalMap with lowercased first char", () => {
      expect(
        new PlaceholderValue({
          kebabToPascalMap: { graphql: "GraphQL" },
          value: "openai-graphql",
        }).toNthSegmentCamelCase(1)
      ).toBe("graphQL");
    });

    it("returns empty string when out of bounds", () => {
      expect(
        new PlaceholderValue({ value: "foo-bar" }).toNthSegmentCamelCase(5)
      ).toBe("");
    });
  });

  describe("toSnakeCase", () => {
    it("lowercases single word", () => {
      expect(new PlaceholderValue({ value: "Openai" }).toSnakeCase()).toBe(
        "openai"
      );
    });

    it("converts hyphens", () => {
      expect(new PlaceholderValue({ value: "test-utils" }).toSnakeCase()).toBe(
        "test_utils"
      );
    });

    it("preserves already snake_case", () => {
      expect(new PlaceholderValue({ value: "test_utils" }).toSnakeCase()).toBe(
        "test_utils"
      );
    });

    it("converts camelCase", () => {
      expect(new PlaceholderValue({ value: "testUtils" }).toSnakeCase()).toBe(
        "test_utils"
      );
    });

    it("uses pascalToKebabMap when entry exists", () => {
      expect(
        new PlaceholderValue({
          pascalToKebabMap: { OpenAI: "openai" },
          value: "OpenAI",
        }).toSnakeCase()
      ).toBe("openai");
    });

    it("uses camelToKebabMap when entry exists", () => {
      expect(
        new PlaceholderValue({
          camelToKebabMap: { openAI: "openai" },
          value: "openAI",
        }).toSnakeCase()
      ).toBe("openai");
    });

    it("converts hyphens in mapped value to underscores", () => {
      expect(
        new PlaceholderValue({
          pascalToKebabMap: { GraphQL: "graph-ql" },
          value: "GraphQL",
        }).toSnakeCase()
      ).toBe("graph_ql");
    });

    it("falls back to default when no map entry exists", () => {
      expect(
        new PlaceholderValue({
          pascalToKebabMap: { OpenAI: "openai" },
          value: "cache",
        }).toSnakeCase()
      ).toBe("cache");
    });
  });

  describe("toConstantCase", () => {
    it("uppercases single word", () => {
      expect(new PlaceholderValue({ value: "Openai" }).toConstantCase()).toBe(
        "OPENAI"
      );
    });

    it("converts hyphens", () => {
      expect(
        new PlaceholderValue({ value: "test-utils" }).toConstantCase()
      ).toBe("TEST_UTILS");
    });

    it("converts snake_case", () => {
      expect(
        new PlaceholderValue({ value: "test_utils" }).toConstantCase()
      ).toBe("TEST_UTILS");
    });

    it("converts camelCase", () => {
      expect(
        new PlaceholderValue({ value: "testUtils" }).toConstantCase()
      ).toBe("TEST_UTILS");
    });

    it("uses pascalToKebabMap when entry exists", () => {
      expect(
        new PlaceholderValue({
          pascalToKebabMap: { GraphQL: "graphql" },
          value: "GraphQL",
        }).toConstantCase()
      ).toBe("GRAPHQL");
    });

    it("uses camelToKebabMap when entry exists", () => {
      expect(
        new PlaceholderValue({
          camelToKebabMap: { graphQL: "graphql" },
          value: "graphQL",
        }).toConstantCase()
      ).toBe("GRAPHQL");
    });

    it("converts hyphens in mapped value to underscores", () => {
      expect(
        new PlaceholderValue({
          pascalToKebabMap: { GraphQL: "graph-ql" },
          value: "GraphQL",
        }).toConstantCase()
      ).toBe("GRAPH_QL");
    });
  });

  describe("extract", () => {
    it("returns first capture group when regex has subgroups", () => {
      expect(
        new PlaceholderValue({ value: "openai" }).extract("^([a-z]+)ai$")
      ).toBe("open");
    });

    it("returns full match when regex has no subgroups", () => {
      expect(
        new PlaceholderValue({ value: "openai" }).extract("^[a-z]+ai$")
      ).toBe("openai");
    });

    it("returns empty string when no match", () => {
      expect(
        new PlaceholderValue({ value: "google" }).extract("^([a-z]+)ai$")
      ).toBe("");
    });

    it("returns first capture group when regex has multiple subgroups", () => {
      expect(
        new PlaceholderValue({ value: "openai-chat" }).extract(
          "^([a-z]+)-([a-z]+)$"
        )
      ).toBe("openai");
    });

    it("returns empty string when regex is invalid", () => {
      expect(
        new PlaceholderValue({ value: "openai" }).extract("[invalid")
      ).toBe("");
    });

    it("supports partial matches when regex is not anchored", () => {
      expect(
        new PlaceholderValue({ value: "openai-v2" }).extract("([a-z]+)ai")
      ).toBe("open");
    });

    it("returns empty string when match captures empty group", () => {
      expect(
        new PlaceholderValue({ value: "openai" }).extract(
          "^([a-z]*)open([a-z]+)$"
        )
      ).toBe("");
    });
  });
});
