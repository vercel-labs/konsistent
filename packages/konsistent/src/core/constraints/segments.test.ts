import { describe, expect, it } from "vitest";
import { validateSegmentsConstraint } from "./segments.js";

describe("validateSegmentsConstraint", () => {
  it("returns true when value has exactly the expected number of segments", () => {
    expect(
      validateSegmentsConstraint({ arg: "2", value: "chat-language" })
    ).toBe(true);
  });

  it("returns false when value has fewer segments than expected", () => {
    expect(validateSegmentsConstraint({ arg: "2", value: "chat" })).toBe(false);
  });

  it("returns false when value has more segments than expected", () => {
    expect(
      validateSegmentsConstraint({ arg: "2", value: "chat-language-model" })
    ).toBe(false);
  });

  it("returns true for single segment with arg 1", () => {
    expect(validateSegmentsConstraint({ arg: "1", value: "chat" })).toBe(true);
  });

  it("returns false when arg is undefined", () => {
    expect(validateSegmentsConstraint({ value: "chat" })).toBe(false);
  });

  it("returns false when arg is not a valid number", () => {
    expect(validateSegmentsConstraint({ arg: "abc", value: "chat" })).toBe(
      false
    );
  });

  it("returns false when arg is zero", () => {
    expect(validateSegmentsConstraint({ arg: "0", value: "chat" })).toBe(false);
  });

  it("returns false when arg is negative", () => {
    expect(validateSegmentsConstraint({ arg: "-1", value: "chat" })).toBe(
      false
    );
  });

  it("handles underscore-separated values", () => {
    expect(
      validateSegmentsConstraint({ arg: "2", value: "chat_language" })
    ).toBe(true);
  });

  it("handles camelCase values", () => {
    expect(
      validateSegmentsConstraint({ arg: "2", value: "chatLanguage" })
    ).toBe(true);
  });
});
