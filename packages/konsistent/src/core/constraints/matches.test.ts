import { describe, expect, it } from "vitest";
import { validateMatchesConstraint } from "./matches.js";

describe("validateMatchesConstraint", () => {
  it("returns true when value matches the regex", () => {
    expect(
      validateMatchesConstraint({ arg: "^[a-z]+ai$", value: "openai" })
    ).toBe(true);
  });

  it("returns false when value does not match the regex", () => {
    expect(
      validateMatchesConstraint({ arg: "^[a-z]+ai$", value: "google" })
    ).toBe(false);
  });

  it("returns true for partial matches when regex is not anchored", () => {
    expect(validateMatchesConstraint({ arg: "ai", value: "openai-v2" })).toBe(
      true
    );
  });

  it("returns false when arg is undefined", () => {
    expect(validateMatchesConstraint({ value: "openai" })).toBe(false);
  });

  it("returns false when regex is invalid", () => {
    expect(
      validateMatchesConstraint({ arg: "[invalid", value: "openai" })
    ).toBe(false);
  });

  it("returns true for empty value matching an empty-allowing regex", () => {
    expect(validateMatchesConstraint({ arg: "^$", value: "" })).toBe(true);
  });

  it("treats regex as case-sensitive by default", () => {
    expect(
      validateMatchesConstraint({ arg: "^[a-z]+ai$", value: "OpenAI" })
    ).toBe(false);
  });
});
