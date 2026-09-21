import ts from "typescript";
import type { PredicateContext } from "../../core/context.js";
import type { Diagnostic, DiagnosticSeverity } from "../../core/diagnostics.js";
import { createDiagnostic } from "../../core/diagnostics.js";
import type { CallInfo, FileStructure } from "../types.js";

interface CallFunctionDefinition {
  arguments?: string[];
  name: string;
}

function unwrapParenthesizedExpression(
  expression: ts.Expression
): ts.Expression {
  let current = expression;
  while (ts.isParenthesizedExpression(current)) {
    current = current.expression;
  }
  return current;
}

function parseExpression(opts: { text: string }): ts.Expression | undefined {
  const sourceFile = ts.createSourceFile(
    "konsistent-expression.ts",
    `(${opts.text});`,
    ts.ScriptTarget.Latest,
    true
  );
  const statement = sourceFile.statements[0];
  if (!(statement && ts.isExpressionStatement(statement))) {
    return;
  }
  return unwrapParenthesizedExpression(statement.expression);
}

function parseExpectedArguments(opts: {
  arguments: string[] | undefined;
  context: PredicateContext;
}): { expressions?: ts.Expression[]; valid: boolean } {
  const { arguments: argumentsList, context } = opts;
  if (argumentsList === undefined) {
    return { valid: true };
  }

  const expressions = argumentsList.map((argument) =>
    parseExpression({ text: context.resolveTemplate(argument) })
  );
  if (expressions.some((expression) => expression === undefined)) {
    return { valid: false };
  }
  return { expressions: expressions as ts.Expression[], valid: true };
}

function normalizeNode(opts: {
  node: ts.Node;
  sourceFile: ts.SourceFile;
}): string {
  const { node, sourceFile } = opts;
  if (ts.isStringLiteral(node)) {
    return `string:${JSON.stringify(node.text)}`;
  }
  if (ts.isIdentifier(node)) {
    return `identifier:${node.text}`;
  }

  const children: string[] = [];
  ts.forEachChild(node, (child) => {
    children.push(normalizeNode({ node: child, sourceFile }));
  });
  if (children.length === 0) {
    return `${node.kind}:${node.getText(sourceFile)}`;
  }
  return `${node.kind}(${children.join(",")})`;
}

function expressionsMatch(opts: {
  actual: ts.Expression;
  expected: ts.Expression;
}): boolean {
  const actualSourceFile = opts.actual.getSourceFile();
  const expectedSourceFile = opts.expected.getSourceFile();
  return (
    normalizeNode({ node: opts.actual, sourceFile: actualSourceFile }) ===
    normalizeNode({ node: opts.expected, sourceFile: expectedSourceFile })
  );
}

function callMatches(opts: {
  call: CallInfo;
  expectedArguments: ts.Expression[] | undefined;
  expectedName: string;
}): boolean {
  const { call, expectedArguments, expectedName } = opts;
  if (call.name !== expectedName) {
    return false;
  }
  if (expectedArguments === undefined) {
    return true;
  }
  if (call.arguments.length < expectedArguments.length) {
    return false;
  }

  return expectedArguments.every((expectedArgument, index) => {
    const actualArgumentText = call.arguments[index];
    if (actualArgumentText === undefined) {
      return false;
    }
    const actualArgument = parseExpression({ text: actualArgumentText });
    return (
      actualArgument !== undefined &&
      expressionsMatch({ actual: actualArgument, expected: expectedArgument })
    );
  });
}

export function checkCallFunction(opts: {
  context: PredicateContext;
  conventionName?: string;
  expected: (string | CallFunctionDefinition)[];
  fileStructure: FileStructure;
  severity?: DiagnosticSeverity;
}): Diagnostic[] {
  const { context, conventionName, expected, fileStructure, severity } = opts;
  const diagnostics: Diagnostic[] = [];

  for (const entry of expected) {
    const definition: CallFunctionDefinition =
      typeof entry === "string" ? { name: entry } : entry;
    const expectedName = context.resolveTemplate(definition.name);
    const parsedArguments = parseExpectedArguments({
      arguments: definition.arguments,
      context,
    });
    const found =
      parsedArguments.valid &&
      fileStructure.calls.some((call) =>
        callMatches({
          call,
          expectedArguments: parsedArguments.expressions,
          expectedName,
        })
      );

    if (found) {
      continue;
    }

    diagnostics.push(
      createDiagnostic({
        filePath: context.path,
        predicateName: "callFunction",
        message:
          definition.arguments === undefined
            ? `Missing call to function "${expectedName}"`
            : `Missing call to function "${expectedName}" with configured arguments`,
        conventionName,
        severity,
      })
    );
  }

  return diagnostics;
}
