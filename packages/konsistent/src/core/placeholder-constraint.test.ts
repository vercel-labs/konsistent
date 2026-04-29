import { describe, expect, it } from "vitest";
import {
  parsePlaceholderConstraint,
  validatePlaceholderConstraint,
} from "./placeholder-constraint.js";

describe("parsePlaceholderConstraint", () => {
  it("parses constraint with argument", () => {
    expect(parsePlaceholderConstraint("segments(2)")).toEqual({
      name: "segments",
      arg: "2",
    });
  });

  it("parses constraint without argument", () => {
    expect(parsePlaceholderConstraint("segments")).toEqual({
      name: "segments",
      arg: undefined,
    });
  });

  it("parses constraint with alphanumeric argument", () => {
    expect(parsePlaceholderConstraint("pattern(abc123)")).toEqual({
      name: "pattern",
      arg: "abc123",
    });
  });

  it("parses constraint with regex-shaped argument", () => {
    expect(parsePlaceholderConstraint("matches(^[a-z]+ai$)")).toEqual({
      name: "matches",
      arg: "^[a-z]+ai$",
    });
  });

  it("parses constraint with argument containing parens", () => {
    expect(parsePlaceholderConstraint("extract(^([a-z]+)ai$)")).toEqual({
      name: "extract",
      arg: "^([a-z]+)ai$",
    });
  });

  it("parses constraint with empty argument", () => {
    expect(parsePlaceholderConstraint("matches()")).toEqual({
      name: "matches",
      arg: "",
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
        value: "chat-language",
        constraint: { name: "segments", arg: "2" },
      })
    ).toBe(true);
  });

  it("returns false when segments constraint fails", () => {
    expect(
      validatePlaceholderConstraint({
        value: "chat",
        constraint: { name: "segments", arg: "2" },
      })
    ).toBe(false);
  });

  it("dispatches to matches constraint and returns true on match", () => {
    expect(
      validatePlaceholderConstraint({
        value: "openai",
        constraint: { name: "matches", arg: "^[a-z]+ai$" },
      })
    ).toBe(true);
  });

  it("dispatches to matches constraint and returns false on no match", () => {
    expect(
      validatePlaceholderConstraint({
        value: "google",
        constraint: { name: "matches", arg: "^[a-z]+ai$" },
      })
    ).toBe(false);
  });

  it("returns true for unknown constraint names", () => {
    expect(
      validatePlaceholderConstraint({
        value: "anything",
        constraint: { name: "unknownConstraint", arg: "1" },
      })
    ).toBe(true);
  });
});
