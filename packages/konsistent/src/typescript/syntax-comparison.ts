import {
  isBigIntLiteral,
  isExpressionStatement,
  isIdentifier,
  isNumericLiteral,
  isParenthesizedExpression,
  isStringLiteral,
  isTemplateLiteralToken,
  type Node,
} from "typescript/unstable/ast";
import type { ParsedSource, TypeScriptSession } from "./native-session.js";
import { withTypeScriptSession } from "./native-session.js";

export function typeSyntaxFingerprint(opts: {
  node: Node;
  source: ParsedSource;
}): string {
  const { node, source } = opts;
  let spelling: string | undefined;
  if (
    isBigIntLiteral(node) ||
    (isNumericLiteral(node) && source.getText({ node }).includes("_"))
  ) {
    spelling = node.text;
  } else if (
    isIdentifier(node) ||
    isStringLiteral(node) ||
    isNumericLiteral(node) ||
    isTemplateLiteralToken(node)
  ) {
    spelling = source.getText({ node });
  }
  const children: string[] = [];
  node.forEachChild((child) => {
    children.push(typeSyntaxFingerprint({ node: child, source }));
  });
  return JSON.stringify([node.kind, spelling, children]);
}

function expressionFingerprint(opts: {
  node: Node;
  source: ParsedSource;
}): string {
  const { node, source } = opts;
  if (isStringLiteral(node)) {
    return `string:${JSON.stringify(node.text)}`;
  }
  if (isIdentifier(node)) {
    return `identifier:${node.text}`;
  }
  const children: string[] = [];
  node.forEachChild((child) => {
    children.push(expressionFingerprint({ node: child, source }));
  });
  return children.length === 0
    ? `${node.kind}:${source.getText({ node })}`
    : `${node.kind}(${children.join(",")})`;
}

export function normalizeArgumentExpression(opts: {
  text: string;
  session?: TypeScriptSession;
}): string | undefined {
  return withTypeScriptSession({
    session: opts.session,
    run: (session) =>
      session.withSourceFile({
        source: `(${opts.text});`,
        filePath: "konsistent-expression.ts",
        visit(source) {
          const statement = source.sourceFile.statements[0];
          if (!(statement && isExpressionStatement(statement))) {
            return;
          }
          let expression = statement.expression;
          while (isParenthesizedExpression(expression)) {
            expression = expression.expression;
          }
          return expressionFingerprint({ node: expression, source });
        },
      }),
  });
}
