import type { SourcePosition } from "./types.js";

export interface NormalizedSource {
  getOriginalOffset(opts: { offset: number }): number;
  getPosition(opts: { offset: number }): SourcePosition;
  text: string;
}

function getLineStarts(source: string): number[] {
  const lineStarts = [0];
  for (let index = 0; index < source.length; index++) {
    const code = source.charCodeAt(index);
    if (code === 13 && source.charCodeAt(index + 1) === 10) {
      lineStarts.push(index + 2);
      index++;
    } else if (
      code === 10 ||
      code === 13 ||
      code === 0x20_28 ||
      code === 0x20_29
    ) {
      lineStarts.push(index + 1);
    }
  }
  return lineStarts;
}

/*
 * The native transport cannot preserve raw lone UTF-16 surrogates. Escaping
 * those code units and removing an initial BOM keeps parsing lossless for
 * literals, while the offset map keeps extracted text and positions tied to
 * the caller's original source rather than the transported representation.
 */
export function normalizeSource(opts: { source: string }): NormalizedSource {
  const { source } = opts;
  const start = source.charCodeAt(0) === 0xfe_ff ? 1 : 0;
  const offsets = [start];
  const parts: string[] = [];
  const lineStarts = getLineStarts(source);

  for (let index = start; index < source.length; index++) {
    const code = source.charCodeAt(index);
    const next = source.charCodeAt(index + 1);
    const previous = source.charCodeAt(index - 1);
    const loneHigh =
      code >= 0xd8_00 &&
      code <= 0xdb_ff &&
      !(next >= 0xdc_00 && next <= 0xdf_ff);
    const loneLow =
      code >= 0xdc_00 &&
      code <= 0xdf_ff &&
      !(previous >= 0xd8_00 && previous <= 0xdb_ff);
    const replacement =
      loneHigh || loneLow ? `\\u${code.toString(16)}` : source[index];
    parts.push(replacement);
    for (let part = 0; part < replacement.length; part++) {
      offsets.push(part === replacement.length - 1 ? index + 1 : index);
    }
  }

  function getOriginalOffset({ offset }: { offset: number }): number {
    return offsets[offset] ?? source.length;
  }

  return {
    text: parts.join(""),
    getOriginalOffset,
    getPosition({ offset }): SourcePosition {
      const originalOffset = getOriginalOffset({ offset });
      let low = 0;
      let high = lineStarts.length;
      while (low + 1 < high) {
        const middle = Math.floor((low + high) / 2);
        if (lineStarts[middle] <= originalOffset) {
          low = middle;
        } else {
          high = middle;
        }
      }
      return { line: low + 1, column: originalOffset - lineStarts[low] + 1 };
    },
  };
}
