import { describe, expect, it } from "vitest";
import { parseRepeatedStringOption } from "./repeated-string-option.js";

describe("parseRepeatedStringOption", () => {
  it("collects separate and assigned values", () => {
    expect(
      parseRepeatedStringOption({
        name: "--paths",
        rawArgs: ["--paths", "src/index.ts", "--paths=packages/**/*.ts"],
      })
    ).toEqual({
      success: true,
      values: ["src/index.ts", "packages/**/*.ts"],
    });
  });

  it("ignores unrelated options", () => {
    expect(
      parseRepeatedStringOption({
        name: "--paths",
        rawArgs: ["--format", "json", "--staged"],
      })
    ).toEqual({ success: true, values: [] });
  });

  it("rejects missing and empty values", () => {
    expect(
      parseRepeatedStringOption({
        name: "--paths",
        rawArgs: ["--paths"],
      })
    ).toEqual({
      error: "--paths requires a non-empty value",
      success: false,
    });
    expect(
      parseRepeatedStringOption({
        name: "--paths",
        rawArgs: ["--paths="],
      })
    ).toEqual({
      error: "--paths requires a non-empty value",
      success: false,
    });
    expect(
      parseRepeatedStringOption({
        name: "--paths",
        rawArgs: ["--paths", ""],
      })
    ).toEqual({
      error: "--paths requires a non-empty value",
      success: false,
    });
  });
});
