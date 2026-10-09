import { describe, expect, it } from "vitest";
import { normalizeSource } from "./source-normalization.js";

describe("source normalization", () => {
  it("preserves Unicode, combining marks, and valid surrogate pairs", () => {
    const source = '/* e\u0301 café 😀 漢 */ const text = "😀";';
    const normalized = normalizeSource({ source });
    expect(normalized.text).toBe(source);
    for (let offset = 0; offset <= source.length; offset++) {
      expect(normalized.getOriginalOffset({ offset })).toBe(offset);
      expect(normalized.getPosition({ offset })).toEqual({
        line: 1,
        column: offset + 1,
      });
    }
  });

  it("maps an initial BOM and escaped lone surrogates back to original offsets", () => {
    const source = '\ufeffconst text = "\ud800\udfff\ud800!\udfff";';
    const normalized = normalizeSource({ source });
    expect(normalized.text).toBe('const text = "\ud800\udfff\\ud800!\\udfff";');
    const offset = normalized.text.indexOf("\\ud800");
    expect(normalized.getOriginalOffset({ offset })).toBe(
      source.indexOf("!\udfff") - 1
    );
    expect(normalized.getOriginalOffset({ offset: offset + 5 })).toBe(
      source.indexOf("!\udfff") - 1
    );
    expect(normalized.getOriginalOffset({ offset: offset + 6 })).toBe(
      source.indexOf("!\udfff")
    );
    expect(
      normalized.getOriginalOffset({ offset: normalized.text.length })
    ).toBe(source.length);
    expect(normalized.getPosition({ offset: 0 })).toEqual({
      line: 1,
      column: 2,
    });
  });

  it("recognizes every TypeScript line separator and counts UTF-16 columns", () => {
    const source = "😀\r\nx\ry\nz\u2028é\u2029end";
    const normalized = normalizeSource({ source });
    for (const [text, line] of [
      ["x", 2],
      ["y", 3],
      ["z", 4],
      ["é", 5],
      ["end", 6],
    ] as const) {
      expect(normalized.getPosition({ offset: source.indexOf(text) })).toEqual({
        line,
        column: 1,
      });
    }
    expect(normalized.getPosition({ offset: 2 })).toEqual({
      line: 1,
      column: 3,
    });
    expect(normalizeSource({ source: "" }).getPosition({ offset: 0 })).toEqual({
      line: 1,
      column: 1,
    });
  });
});
