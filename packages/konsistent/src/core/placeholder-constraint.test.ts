import { describe, expect, it } from "vitest";
import {
  parsePlaceholderConstraint,
  validatePlaceholderConstraint,
} from "./placeholder-constraint.js";

describe("parsePlaceholderConstraint", () => {
  it("parses constraint with argument", () => {
    expect(parsePlaceholderConstraint("segments(2)")).toEqual({
      arg: "2",
      name: "segments",
    });
  });

  it("parses constraint without argument", () => {
    expect(parsePlaceholderConstraint("segments")).toEqual({
      arg: undefined,
      name: "segments",
    });
  });

  it("parses constraint with alphanumeric argument", () => {
    expect(parsePlaceholderConstraint("pattern(abc123)")).toEqual({
      arg: "abc123",
      name: "pattern",
    });
  });

  it("parses constraint with regex-shaped argument", () => {
    expect(parsePlaceholderConstraint("matches(^[a-z]+ai$)")).toEqual({
      arg: "^[a-z]+ai$",
      name: "matches",
    });
  });

  it("parses constraint with argument containing parens", () => {
    expect(parsePlaceholderConstraint("extract(^([a-z]+)ai$)")).toEqual({
      arg: "^([a-z]+)ai$",
      name: "extract",
    });
  });

  it("parses constraint with empty argument", () => {
    expect(parsePlaceholderConstraint("matches()")).toEqual({
      arg: "",
      name: "matches",
    });
  });

  it("returns null for empty string", () => {
    expect(parsePlaceholderConstraint("")).toBeNull();
  });

  it("returns null for invalid format", () => {
    expect(parsePlaceholderConstraint("(2)")).toBeNull();
  });

  it("returns null for unclosed parenthesis", () => {
    expect(parsePlaceholderConstraint("segments(2")).toBeNull();
  });
});

describe("validatePlaceholderConstraint", () => {
  it("dispatches to segments constraint", () => {
    expect(
      validatePlaceholderConstraint({
        constraint: { arg: "2", name: "segments" },
        value: "chat-language",
      })
    ).toBe(true);
  });

  it("returns false when segments constraint fails", () => {
    expect(
      validatePlaceholderConstraint({
        constraint: { arg: "2", name: "segments" },
        value: "chat",
      })
    ).toBe(false);
  });

  it("dispatches to matches constraint and returns true on match", () => {
    expect(
      validatePlaceholderConstraint({
        constraint: { arg: "^[a-z]+ai$", name: "matches" },
        value: "openai",
      })
    ).toBe(true);
  });

  it("dispatches to matches constraint and returns false on no match", () => {
    expect(
      validatePlaceholderConstraint({
        constraint: { arg: "^[a-z]+ai$", name: "matches" },
        value: "google",
      })
    ).toBe(false);
  });

  it("returns true for unknown constraint names", () => {
    expect(
      validatePlaceholderConstraint({
        constraint: { arg: "1", name: "unknownConstraint" },
        value: "anything",
      })
    ).toBe(true);
  });
});
