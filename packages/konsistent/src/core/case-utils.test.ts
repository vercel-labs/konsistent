import { describe, expect, it } from "vitest";
import {
  splitWords,
  toCamelCase,
  toConstantCase,
  toKebabCase,
  toPascalCase,
  toSnakeCase,
} from "./case-utils.js";

describe("splitWords", () => {
  it("splits hyphenated words", () => {
    expect(splitWords("test-utils")).toEqual(["test", "utils"]);
  });

  it("splits underscore-separated words", () => {
    expect(splitWords("test_utils")).toEqual(["test", "utils"]);
  });

  it("splits camelCase boundaries", () => {
    expect(splitWords("testUtils")).toEqual(["test", "Utils"]);
  });

  it("handles single word", () => {
    expect(splitWords("openai")).toEqual(["openai"]);
  });

  it("filters empty segments", () => {
    expect(splitWords("--foo--")).toEqual(["foo"]);
  });
});

describe("toPascalCase", () => {
  it("capitalizes single word", () => {
    expect(toPascalCase("openai")).toBe("Openai");
  });

  it("handles hyphenated", () => {
    expect(toPascalCase("test-utils")).toBe("TestUtils");
  });

  it("handles camelCase input", () => {
    expect(toPascalCase("testUtils")).toBe("TestUtils");
  });
});

describe("toCamelCase", () => {
  it("lowercases single word", () => {
    expect(toCamelCase("Openai")).toBe("openai");
  });

  it("handles hyphenated", () => {
    expect(toCamelCase("test-utils")).toBe("testUtils");
  });

  it("returns empty string for empty input", () => {
    expect(toCamelCase("")).toBe("");
  });
});

describe("toKebabCase", () => {
  it("converts camelCase", () => {
    expect(toKebabCase("testUtils")).toBe("test-utils");
  });

  it("preserves already kebab-case", () => {
    expect(toKebabCase("test-utils")).toBe("test-utils");
  });
});

describe("toSnakeCase", () => {
  it("converts hyphenated", () => {
    expect(toSnakeCase("test-utils")).toBe("test_utils");
  });

  it("converts camelCase", () => {
    expect(toSnakeCase("testUtils")).toBe("test_utils");
  });
});

describe("toConstantCase", () => {
  it("converts hyphenated", () => {
    expect(toConstantCase("test-utils")).toBe("TEST_UTILS");
  });

  it("converts snake_case", () => {
    expect(toConstantCase("test_utils")).toBe("TEST_UTILS");
  });

  it("converts camelCase", () => {
    expect(toConstantCase("testUtils")).toBe("TEST_UTILS");
  });
});
