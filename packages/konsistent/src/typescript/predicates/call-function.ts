import type { PredicateContext } from "../../core/context.js";
import type { Diagnostic, DiagnosticSeverity } from "../../core/diagnostics.js";
import { createDiagnostic } from "../../core/diagnostics.js";
import { normalizeArgumentExpression } from "../syntax-comparison.js";
import type { CallInfo, FileStructure } from "../types.js";

interface CallFunctionDefinition {
  arguments?: string[];
  name: string;
}

function parseExpectedArguments(opts: {
  arguments: string[] | undefined;
  context: PredicateContext;
}): { expressions?: string[]; valid: boolean } {
  const { arguments: argumentsList, context } = opts;
  if (argumentsList === undefined) {
    return { valid: true };
  }

  const expressions = argumentsList.map((argument) =>
    normalizeArgumentExpression({
      text: context.resolveTemplate(argument),
      session: context.typescriptSession,
    })
  );
  if (expressions.some((expression) => expression === undefined)) {
    return { valid: false };
  }
  return { expressions: expressions as string[], valid: true };
}

function callMatches(opts: {
  call: CallInfo;
  context: PredicateContext;
  expectedArguments: string[] | undefined;
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
    const actualArgument = normalizeArgumentExpression({
      text: actualArgumentText,
      session: opts.context.typescriptSession,
    });
    return actualArgument !== undefined && actualArgument === expectedArgument;
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
          context,
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
