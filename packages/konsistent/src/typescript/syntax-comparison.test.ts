import { isTypeAliasDeclaration } from "typescript/unstable/ast";
import { describe, expect, it } from "vitest";
import { withTypeScriptSession } from "./native-session.js";
import {
  normalizeArgumentExpression,
  typeSyntaxFingerprint,
} from "./syntax-comparison.js";

describe("syntax comparisons", () => {
  it("preserves type spelling and grouping while normalizing separator literals", () => {
    withTypeScriptSession({
      run(session) {
        const fingerprint = (type: string) =>
          session.withSourceFile({
            source: `type Value = ${type};`,
            visit(source) {
              const node = source.sourceFile.statements[0];
              if (!(node && isTypeAliasDeclaration(node))) {
                throw new Error("Expected a type alias");
              }
              return typeSyntaxFingerprint({ node: node.type, source });
            },
          });
        for (const [actual, expected] of [
          ["1_000", "1000"],
          ["0x1_0", "16"],
          ["100n", "1_00n"],
          ["0X10n", "0x10n"],
        ]) {
          expect(fingerprint(actual)).toBe(fingerprint(expected));
        }
        for (const [actual, expected] of [
          ["(A)", "A"],
          ["0x10", "16"],
          ["\\u0041", "A"],
          ['"\\u0061"', '"a"'],
          ['"\ud800"', '"\\ud800"'],
        ]) {
          expect(fingerprint(actual)).not.toBe(fingerprint(expected));
        }
      },
    });
  });

  it("decodes only expression identifiers and strings and unwraps outer parentheses", () => {
    withTypeScriptSession({
      run(session) {
        const normalize = (text: string) =>
          normalizeArgumentExpression({ text, session });
        for (const [actual, expected] of [
          ['("email")', "'email'"],
          ['"\\u0061"', '"a"'],
          ["\\u0041", "A"],
          ['"\\ud800"', '"\ud800"'],
          ["{ a: 1 }", "{a:1}"],
        ]) {
          expect(normalize(actual)).toBe(normalize(expected));
        }
        for (const [actual, expected] of [
          ["1_000", "1000"],
          ["100n", "1_00n"],
          ["callback as Fn", "callback"],
          ["1 + 2", "1 - 2"],
          ["`a b`", "`ab`"],
        ]) {
          expect(normalize(actual)).not.toBe(normalize(expected));
        }
      },
    });
  });
});
