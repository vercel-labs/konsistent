import type { PredicateContext } from "../../core/context.js";
import type { Diagnostic, DiagnosticSeverity } from "../../core/diagnostics.js";
import { createDiagnostic } from "../../core/diagnostics.js";
import type { FileStructure, SourcePosition } from "../types.js";

interface SymbolOccurrence {
  name: string;
  pos: SourcePosition;
}

function comparePositions(opts: {
  a: SourcePosition;
  b: SourcePosition;
}): number {
  const { a, b } = opts;
  if (a.line !== b.line) {
    return a.line - b.line;
  }
  return a.column - b.column;
}

function getOrderedOccurrences(opts: {
  fileStructure: FileStructure;
  orderedNames: Set<string>;
}): SymbolOccurrence[] {
  const { fileStructure, orderedNames } = opts;
  const occurrencesByName = new Map<string, SymbolOccurrence>();
  const declaredNames = new Set<string>();

  for (const symbol of fileStructure.declarationSymbols) {
    if (orderedNames.has(symbol.name) && !occurrencesByName.has(symbol.name)) {
      occurrencesByName.set(symbol.name, {
        name: symbol.name,
        pos: symbol.pos,
      });
      declaredNames.add(symbol.name);
    }
  }

  for (const symbol of fileStructure.namedExportSymbols) {
    if (
      orderedNames.has(symbol.name) &&
      !declaredNames.has(symbol.name) &&
      !occurrencesByName.has(symbol.name)
    ) {
      occurrencesByName.set(symbol.name, {
        name: symbol.name,
        pos: symbol.pos,
      });
    }
  }

  return [...occurrencesByName.values()].sort((a, b) =>
    comparePositions({ a: a.pos, b: b.pos })
  );
}

export function checkUseDeclarationOrder(opts: {
  expected: string[];
  context: PredicateContext;
  fileStructure: FileStructure;
  conventionName?: string;
  severity?: DiagnosticSeverity;
}): Diagnostic[] {
  const { expected, context, fileStructure, conventionName, severity } = opts;
  const orderByName = new Map<string, number>();

  for (const entry of expected) {
    const resolvedName = context.resolveTemplate(entry);
    if (!orderByName.has(resolvedName)) {
      orderByName.set(resolvedName, orderByName.size);
    }
  }

  const occurrences = getOrderedOccurrences({
    fileStructure,
    orderedNames: new Set(orderByName.keys()),
  });
  const diagnostics: Diagnostic[] = [];
  let maxSeenIndex = -1;
  let maxSeenName = "";

  for (const occurrence of occurrences) {
    const currentIndex = orderByName.get(occurrence.name);
    if (currentIndex === undefined) {
      continue;
    }
    if (currentIndex < maxSeenIndex) {
      diagnostics.push(
        createDiagnostic({
          filePath: context.path,
          predicateName: "useDeclarationOrder",
          message: `Symbol "${occurrence.name}" must be declared before "${maxSeenName}"`,
          conventionName,
          line: occurrence.pos.line,
          column: occurrence.pos.column,
          severity,
        })
      );
      continue;
    }
    maxSeenIndex = currentIndex;
    maxSeenName = occurrence.name;
  }

  return diagnostics;
}
