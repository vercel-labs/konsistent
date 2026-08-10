import { describe, expect, it } from "vitest";
import { parseRepeatedStringOption } from "./repeated-string-option.js";

describe("parseRepeatedStringOption", () => {
  it("collects separate and assigned values", () => {
    expect(
      parseRepeatedStringOption({
        rawArgs: ["--paths", "src/index.ts", "--paths=packages/**/*.ts"],
        name: "--paths",
      })
    ).toEqual({
      success: true,
      values: ["src/index.ts", "packages/**/*.ts"],
    });
  });

  it("ignores unrelated options", () => {
    expect(
      parseRepeatedStringOption({
        rawArgs: ["--format", "json", "--staged"],
        name: "--paths",
      })
    ).toEqual({ success: true, values: [] });
  });

  it("rejects missing and empty values", () => {
    expect(
      parseRepeatedStringOption({
        rawArgs: ["--paths"],
        name: "--paths",
      })
    ).toEqual({
      success: false,
      error: "--paths requires a non-empty value",
    });
    expect(
      parseRepeatedStringOption({
        rawArgs: ["--paths="],
        name: "--paths",
      })
    ).toEqual({
      success: false,
      error: "--paths requires a non-empty value",
    });
  });
});
