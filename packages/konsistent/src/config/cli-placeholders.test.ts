import { describe, expect, it } from "vitest";
import {
  normalizePlaceholderArg,
  parseCliPlaceholders,
} from "./cli-placeholders.js";

describe("parseCliPlaceholders", () => {
  it("returns an empty record when no entries are passed", () => {
    const result = parseCliPlaceholders({ raw: [] });
    expect(result).toEqual({ success: true, placeholders: {} });
  });

  it("parses a single name:value pair", () => {
    const result = parseCliPlaceholders({ raw: ["providerId:openai"] });
    expect(result).toEqual({
      success: true,
      placeholders: { providerId: "openai" },
    });
  });

  it("parses multiple pairs and preserves last-wins ordering", () => {
    const result = parseCliPlaceholders({
      raw: ["a:1", "b:2", "a:overridden"],
    });
    expect(result).toEqual({
      success: true,
      placeholders: { a: "overridden", b: "2" },
    });
  });

  it("rejects an entry without a colon", () => {
    const result = parseCliPlaceholders({ raw: ["nocolon"] });
    expect(result.success).toBe(false);
  });

  it("rejects an entry that starts with a colon", () => {
    const result = parseCliPlaceholders({ raw: [":value"] });
    expect(result.success).toBe(false);
  });

  it("rejects an entry that ends with a colon", () => {
    const result = parseCliPlaceholders({ raw: ["name:"] });
    expect(result.success).toBe(false);
  });

  it("rejects an invalid name", () => {
    const result = parseCliPlaceholders({ raw: ["1bad:value"] });
    expect(result.success).toBe(false);
  });

  it("rejects an invalid value", () => {
    const result = parseCliPlaceholders({ raw: ["name:bad value"] });
    expect(result.success).toBe(false);
  });
});

describe("normalizePlaceholderArg", () => {
  it("returns an empty array for undefined", () => {
    expect(normalizePlaceholderArg(undefined)).toEqual([]);
  });

  it("wraps a string into a single-element array", () => {
    expect(normalizePlaceholderArg("a:1")).toEqual(["a:1"]);
  });

  it("returns the array unchanged when already an array", () => {
    expect(normalizePlaceholderArg(["a:1", "b:2"])).toEqual(["a:1", "b:2"]);
  });
});
