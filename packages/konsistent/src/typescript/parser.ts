import {
  type ExportAssignment,
  type ExportDeclaration,
  type Expression,
  type HeritageClause,
  type ImportDeclaration,
  isAsExpression,
  isCallExpression,
  isClassDeclaration,
  isEnumDeclaration,
  isExportAssignment,
  isExportDeclaration,
  isExpressionStatement,
  isFunctionDeclaration,
  isIdentifier,
  isImportDeclaration,
  isInterfaceDeclaration,
  isModuleDeclaration,
  isNamedExports,
  isNamedImports,
  isNamespaceImport,
  isNonNullExpression,
  isParenthesizedExpression,
  isPropertyAccessExpression,
  isSatisfiesExpression,
  isTypeAliasDeclaration,
  isTypeAssertion,
  isTypeReferenceNode,
  isVariableStatement,
  type ModifiersBase,
  type Node,
  type NodeArray,
  NodeFlags,
  type ParameterDeclaration,
  type StringLiteral,
  SyntaxKind,
  type TypeNode,
  type VariableStatement,
} from "typescript/unstable/ast";
import {
  parseInterfaceTypeShape,
  parseTypeShape,
} from "./constant-type-schema.js";
import type { ParsedSource, TypeScriptSession } from "./native-session.js";
import { withTypeScriptSession } from "./native-session.js";
import type {
  CallInfo,
  ClassInfo,
  ConstantInfo,
  DeclarationSymbolInfo,
  DefaultExportSymbolInfo,
  ExportInfo,
  ExtendsClauseInfo,
  FileStructure,
  FunctionInfo,
  ImportInfo,
  ImportSourceInfo,
  InterfaceInfo,
  NamedExportSymbolInfo,
  NonBarrelStatementInfo,
  ParamInfo,
  SourcePosition,
  TypeAliasInfo,
  TypeAnnotationInfo,
} from "./types.js";

function getPosition(opts: {
  parsedSource: ParsedSource;
  node: Node;
}): SourcePosition {
  return opts.parsedSource.getPosition({ node: opts.node });
}

function hasExportModifier(node: Node): boolean {
  return (
    (node as ModifiersBase).modifiers?.some(
      (modifier) => modifier.kind === SyntaxKind.ExportKeyword
    ) ?? false
  );
}

function hasDefaultModifier(node: Node): boolean {
  return (
    (node as ModifiersBase).modifiers?.some(
      (modifier) => modifier.kind === SyntaxKind.DefaultKeyword
    ) ?? false
  );
}

function extractTypeAnnotation(opts: {
  node: TypeNode | undefined;
  parsedSource: ParsedSource;
}): TypeAnnotationInfo | undefined {
  const { node, parsedSource } = opts;
  if (!node) {
    return;
  }
  const text = parsedSource.getText({ node });
  if (isTypeReferenceNode(node)) {
    return { baseName: parsedSource.getText({ node: node.typeName }), text };
  }
  return { baseName: text, text };
}

function extractParams(opts: {
  params: NodeArray<ParameterDeclaration>;
  parsedSource: ParsedSource;
}): ParamInfo[] {
  const { params, parsedSource } = opts;
  return params.map((p) => ({
    name: parsedSource.getText({ node: p.name }),
    typeName: extractTypeAnnotation({ node: p.type, parsedSource }),
  }));
}

function extractExtendsFromHeritage(opts: {
  clauses: NodeArray<HeritageClause> | undefined;
  kind: SyntaxKind;
  parsedSource: ParsedSource;
}): ExtendsClauseInfo[] {
  const { clauses, kind, parsedSource } = opts;
  if (!clauses) {
    return [];
  }
  const result: ExtendsClauseInfo[] = [];
  for (const clause of clauses) {
    if (clause.token === kind) {
      for (const type of clause.types) {
        result.push({
          name: parsedSource.getText({ node: type.expression }),
          typeArguments: type.typeArguments
            ? type.typeArguments.map((arg) =>
                parsedSource.getText({ node: arg })
              )
            : [],
        });
      }
    }
  }
  return result;
}

function processExportDeclaration(opts: {
  node: ExportDeclaration;
  parsedSource: ParsedSource;
}): ExportInfo[] {
  const { node, parsedSource } = opts;
  const exports: ExportInfo[] = [];
  const isType = node.isTypeOnly;
  const from = node.moduleSpecifier
    ? (node.moduleSpecifier as StringLiteral).text
    : undefined;
  const pos = getPosition({ node, parsedSource });

  if (node.exportClause && isNamedExports(node.exportClause)) {
    for (const element of node.exportClause.elements) {
      const exportInfo: ExportInfo = {
        isType: isType || element.isTypeOnly,
        kind: "re-export",
        name: parsedSource.getText({
          node: element.propertyName ?? element.name,
        }),
        pos,
      };
      if (from !== undefined) {
        exportInfo.from = from;
      }
      exports.push(exportInfo);
    }
  } else if (!node.exportClause && from) {
    exports.push({
      from,
      isType,
      kind: "re-export",
      name: "*",
      pos,
    });
  }

  return exports;
}

function processNamedExportSymbols(opts: {
  node: ExportDeclaration;
  parsedSource: ParsedSource;
}): NamedExportSymbolInfo[] {
  const { node, parsedSource } = opts;
  const symbols: NamedExportSymbolInfo[] = [];
  const from = node.moduleSpecifier
    ? (node.moduleSpecifier as StringLiteral).text
    : undefined;

  if (!(node.exportClause && isNamedExports(node.exportClause))) {
    return symbols;
  }

  for (const element of node.exportClause.elements) {
    const symbol: NamedExportSymbolInfo = {
      isType: node.isTypeOnly || element.isTypeOnly,
      name: parsedSource.getText({ node: element.name }),
      pos: getPosition({ node: element.name, parsedSource }),
      sourceName: parsedSource.getText({
        node: element.propertyName ?? element.name,
      }),
    };
    if (from !== undefined) {
      symbol.from = from;
    }
    symbols.push(symbol);
  }

  return symbols;
}

function processExportedDeclaration(opts: {
  node: Node;
  parsedSource: ParsedSource;
}): ExportInfo | undefined {
  const { node, parsedSource } = opts;
  const pos = getPosition({ node, parsedSource });

  if (isFunctionDeclaration(node) && node.name) {
    return {
      isType: false,
      kind: "function",
      name: parsedSource.getText({ node: node.name }),
      pos,
    };
  }
  if (isClassDeclaration(node) && node.name) {
    return {
      isType: false,
      kind: "class",
      name: parsedSource.getText({ node: node.name }),
      pos,
    };
  }
  if (isInterfaceDeclaration(node)) {
    return {
      isType: true,
      kind: "interface",
      name: parsedSource.getText({ node: node.name }),
      pos,
    };
  }
  if (isEnumDeclaration(node)) {
    return {
      isType: false,
      kind: "enum",
      name: parsedSource.getText({ node: node.name }),
      pos,
    };
  }
  if (isTypeAliasDeclaration(node)) {
    return {
      isType: true,
      kind: "interface",
      name: parsedSource.getText({ node: node.name }),
      pos,
    };
  }
  if (isVariableStatement(node)) {
    const [decl] = node.declarationList.declarations;
    if (decl?.name && isIdentifier(decl.name)) {
      return {
        isType: false,
        kind: "const",
        name: parsedSource.getText({ node: decl.name }),
        pos,
      };
    }
  }
}

interface ParseCollector {
  calls: CallInfo[];
  classes: ClassInfo[];
  constants: ConstantInfo[];
  declarationSymbols: DeclarationSymbolInfo[];
  defaultExportSymbols: DefaultExportSymbolInfo[];
  exports: ExportInfo[];
  functions: FunctionInfo[];
  importSources: ImportSourceInfo[];
  imports: ImportInfo[];
  interfaces: InterfaceInfo[];
  namedExportSymbols: NamedExportSymbolInfo[];
  nonBarrelStatements: NonBarrelStatementInfo[];
  typeAliases: TypeAliasInfo[];
}

function getImportSourceKinds(opts: { node: ImportDeclaration }): {
  hasType: boolean;
  hasValue: boolean;
} {
  const { node } = opts;
  const { importClause } = node;
  if (!importClause) {
    return { hasType: false, hasValue: true };
  }
  if (importClause.phaseModifier === SyntaxKind.TypeKeyword) {
    return { hasType: true, hasValue: false };
  }

  let hasType = false;
  let hasValue = Boolean(importClause.name);
  const { namedBindings } = importClause;

  if (namedBindings) {
    if (isNamespaceImport(namedBindings)) {
      hasValue = true;
    } else {
      for (const element of namedBindings.elements) {
        if (element.isTypeOnly) {
          hasType = true;
        } else {
          hasValue = true;
        }
      }
    }
  }

  return { hasType, hasValue: hasValue || !hasType };
}

function processImportDeclaration(opts: {
  node: ImportDeclaration;
  parsedSource: ParsedSource;
  collector: ParseCollector;
}): void {
  const { node, parsedSource, collector } = opts;
  const pos = getPosition({ node, parsedSource });
  const moduleSpecifier = (node.moduleSpecifier as StringLiteral).text;
  const isTypeOnly =
    node.importClause?.phaseModifier === SyntaxKind.TypeKeyword;
  const sourceKinds = getImportSourceKinds({ node });

  if (sourceKinds.hasValue) {
    collector.importSources.push({
      from: moduleSpecifier,
      isType: false,
      pos,
    });
  }
  if (sourceKinds.hasType) {
    collector.importSources.push({
      from: moduleSpecifier,
      isType: true,
      pos,
    });
  }

  if (node.importClause?.namedBindings) {
    if (isNamedImports(node.importClause.namedBindings)) {
      for (const element of node.importClause.namedBindings.elements) {
        collector.imports.push({
          from: moduleSpecifier,
          isType: isTypeOnly || element.isTypeOnly,
          kind: "named",
          name: parsedSource.getText({ node: element.name }),
          pos,
          sourceName: parsedSource.getText({
            node: element.propertyName ?? element.name,
          }),
        });
      }
    } else if (isNamespaceImport(node.importClause.namedBindings)) {
      collector.imports.push({
        from: moduleSpecifier,
        isType: isTypeOnly,
        kind: "namespace",
        name: parsedSource.getText({
          node: node.importClause.namedBindings.name,
        }),
        pos,
      });
    }
  }

  if (node.importClause?.name) {
    collector.imports.push({
      from: moduleSpecifier,
      isType: isTypeOnly,
      kind: "default",
      name: parsedSource.getText({ node: node.importClause.name }),
      pos,
    });
  }
}

function processDeclarationSymbols(opts: {
  node: Node;
  parsedSource: ParsedSource;
  collector: ParseCollector;
}): void {
  const { node, parsedSource, collector } = opts;
  const isExported = hasExportModifier(node);
  const isDefaultExport = hasDefaultModifier(node);

  if (isFunctionDeclaration(node) && node.name) {
    collector.declarationSymbols.push({
      isDefaultExport,
      isExported,
      kind: "function",
      name: parsedSource.getText({ node: node.name }),
      pos: getPosition({ node: node.name, parsedSource }),
    });
  }

  if (isClassDeclaration(node) && node.name) {
    collector.declarationSymbols.push({
      isDefaultExport,
      isExported,
      kind: "class",
      name: parsedSource.getText({ node: node.name }),
      pos: getPosition({ node: node.name, parsedSource }),
    });
  }

  if (isInterfaceDeclaration(node)) {
    collector.declarationSymbols.push({
      isDefaultExport,
      isExported,
      kind: "interface",
      name: parsedSource.getText({ node: node.name }),
      pos: getPosition({ node: node.name, parsedSource }),
    });
  }

  if (isTypeAliasDeclaration(node)) {
    collector.declarationSymbols.push({
      isDefaultExport,
      isExported,
      kind: "type",
      name: parsedSource.getText({ node: node.name }),
      pos: getPosition({ node: node.name, parsedSource }),
    });
  }

  if (isEnumDeclaration(node)) {
    collector.declarationSymbols.push({
      isDefaultExport,
      isExported,
      kind: "enum",
      name: parsedSource.getText({ node: node.name }),
      pos: getPosition({ node: node.name, parsedSource }),
    });
  }

  if (isVariableStatement(node)) {
    // biome-ignore lint/suspicious/noBitwiseOperators: TypeScript NodeFlags is a bitfield enum
    const isConst = (node.declarationList.flags & NodeFlags.Const) !== 0;
    if (!isConst) {
      return;
    }
    for (const decl of node.declarationList.declarations) {
      if (isIdentifier(decl.name)) {
        collector.declarationSymbols.push({
          isDefaultExport,
          isExported,
          kind: "const",
          name: parsedSource.getText({ node: decl.name }),
          pos: getPosition({ node: decl.name, parsedSource }),
        });
      }
    }
  }
}

function processVariableStatement(opts: {
  node: VariableStatement;
  parsedSource: ParsedSource;
  collector: ParseCollector;
}): void {
  const { node, parsedSource, collector } = opts;
  // biome-ignore lint/suspicious/noBitwiseOperators: TypeScript NodeFlags is a bitfield enum
  const isConst = (node.declarationList.flags & NodeFlags.Const) !== 0;
  if (!isConst) {
    return;
  }
  for (const decl of node.declarationList.declarations) {
    if (isIdentifier(decl.name)) {
      const pos = getPosition({ node, parsedSource });
      collector.constants.push({
        name: parsedSource.getText({ node: decl.name }),
        pos,
        typeInfo: parseTypeShape({ node: decl.type, source: parsedSource }),
        typeName: extractTypeAnnotation({ node: decl.type, parsedSource }),
      });
    }
  }
}

function processDeclaration(opts: {
  node: Node;
  parsedSource: ParsedSource;
  collector: ParseCollector;
}): void {
  const { node, parsedSource, collector } = opts;

  if (isInterfaceDeclaration(node)) {
    const pos = getPosition({ node, parsedSource });
    collector.interfaces.push({
      extends: extractExtendsFromHeritage({
        clauses: node.heritageClauses,
        kind: SyntaxKind.ExtendsKeyword,
        parsedSource,
      }),
      name: parsedSource.getText({ node: node.name }),
      pos,
      typeInfo: parseInterfaceTypeShape({ node, source: parsedSource }),
    });
  }

  if (isClassDeclaration(node) && node.name) {
    const pos = getPosition({ node, parsedSource });
    const extendsClauses = extractExtendsFromHeritage({
      clauses: node.heritageClauses,
      kind: SyntaxKind.ExtendsKeyword,
      parsedSource,
    });
    const implementsClauses = extractExtendsFromHeritage({
      clauses: node.heritageClauses,
      kind: SyntaxKind.ImplementsKeyword,
      parsedSource,
    });
    collector.classes.push({
      extends: extendsClauses[0]?.name,
      implements: implementsClauses.map((c) => c.name),
      name: parsedSource.getText({ node: node.name }),
      pos,
    });
  }

  if (isFunctionDeclaration(node) && node.name) {
    const pos = getPosition({ node, parsedSource });
    collector.functions.push({
      name: parsedSource.getText({ node: node.name }),
      params: extractParams({ params: node.parameters, parsedSource }),
      pos,
      returnType: extractTypeAnnotation({ node: node.type, parsedSource }),
    });
  }

  if (isVariableStatement(node)) {
    processVariableStatement({ collector, node, parsedSource });
  }

  if (isTypeAliasDeclaration(node)) {
    const pos = getPosition({ node, parsedSource });
    collector.typeAliases.push({
      name: parsedSource.getText({ node: node.name }),
      pos,
      typeInfo: parseTypeShape({ node: node.type, source: parsedSource }),
      typeName: extractTypeAnnotation({
        node: node.type,
        parsedSource,
      }) as TypeAnnotationInfo,
    });
  }
}

function processExportModifier(opts: {
  node: Node;
  parsedSource: ParsedSource;
  collector: ParseCollector;
}): void {
  const { node, parsedSource, collector } = opts;
  if (hasDefaultModifier(node)) {
    const pos = getPosition({ node, parsedSource });
    collector.exports.push({
      isType: false,
      kind: "const",
      name: "default",
      pos,
    });
  } else {
    const exportInfo = processExportedDeclaration({ node, parsedSource });
    if (exportInfo) {
      collector.exports.push(exportInfo);
    }
  }
}

function unwrapCallExpressionName(expression: Expression): Expression {
  let current = expression;
  while (
    isParenthesizedExpression(current) ||
    isAsExpression(current) ||
    isTypeAssertion(current) ||
    isNonNullExpression(current) ||
    isSatisfiesExpression(current)
  ) {
    current = current.expression;
  }
  return current;
}

function extractCallName(opts: {
  expression: Expression;
  parsedSource: ParsedSource;
}): string | undefined {
  const expression = unwrapCallExpressionName(opts.expression);
  if (isIdentifier(expression)) {
    return opts.parsedSource.getText({ node: expression });
  }
  if (isPropertyAccessExpression(expression)) {
    return opts.parsedSource.getText({ node: expression.name });
  }
}

function processCalls(opts: {
  node: Node;
  parsedSource: ParsedSource;
  collector: ParseCollector;
}): void {
  const { node, parsedSource, collector } = opts;
  if (isCallExpression(node)) {
    const name = extractCallName({
      expression: node.expression,
      parsedSource,
    });
    if (name) {
      collector.calls.push({
        arguments: node.arguments.map((argument) =>
          parsedSource.getText({ node: argument })
        ),
        name,
        pos: getPosition({ node, parsedSource }),
      });
    }
  }

  node.forEachChild((child) => {
    processCalls({ collector, node: child, parsedSource });
  });
}

export function parseFileStructure(opts: {
  source: string;
  filePath?: string;
  session?: TypeScriptSession;
}): FileStructure {
  return withTypeScriptSession({
    run: (session) =>
      session.withSourceFile({
        filePath: opts.filePath,
        source: opts.source,
        visit: (parsedSource) => collectFileStructure({ parsedSource }),
      }),
    session: opts.session,
  });
}

function collectFileStructure(opts: {
  parsedSource: ParsedSource;
}): FileStructure {
  const { parsedSource } = opts;

  const collector: ParseCollector = {
    calls: [],
    classes: [],
    constants: [],
    declarationSymbols: [],
    defaultExportSymbols: [],
    exports: [],
    functions: [],
    importSources: [],
    imports: [],
    interfaces: [],
    namedExportSymbols: [],
    nonBarrelStatements: [],
    typeAliases: [],
  };

  parsedSource.sourceFile.forEachChild((node) => {
    if (isExportDeclaration(node)) {
      collector.exports.push(
        ...processExportDeclaration({ node, parsedSource })
      );
      collector.namedExportSymbols.push(
        ...processNamedExportSymbols({ node, parsedSource })
      );
      return;
    }

    if (isExportAssignment(node)) {
      const pos = getPosition({ node, parsedSource });
      collector.exports.push({
        isType: false,
        kind: "const",
        name: "default",
        pos,
      });
      if (!node.isExportEquals && isIdentifier(node.expression)) {
        collector.defaultExportSymbols.push({
          name: parsedSource.getText({ node: node.expression }),
          pos: getPosition({ node: node.expression, parsedSource }),
        });
      }
      return;
    }

    if (isImportDeclaration(node)) {
      processImportDeclaration({ collector, node, parsedSource });
      return;
    }

    processDeclaration({ collector, node, parsedSource });
    processDeclarationSymbols({ collector, node, parsedSource });

    if (hasExportModifier(node)) {
      processExportModifier({ collector, node, parsedSource });
    }
  });

  processCalls({ collector, node: parsedSource.sourceFile, parsedSource });

  classifyNonBarrelStatements({ collector, parsedSource });

  return collector;
}

function classifyNonBarrelStatements(opts: {
  parsedSource: ParsedSource;
  collector: ParseCollector;
}): void {
  const { parsedSource, collector } = opts;
  const importedNames = new Set(collector.imports.map((i) => i.name));

  parsedSource.sourceFile.forEachChild((node) => {
    const kind = classifyTopLevelNode({ importedNames, node, parsedSource });
    if (kind) {
      collector.nonBarrelStatements.push({
        kind,
        pos: getPosition({ node, parsedSource }),
      });
    }
  });
}

function classifyExportDeclaration(opts: {
  node: ExportDeclaration;
  parsedSource: ParsedSource;
  importedNames: Set<string>;
}): NonBarrelStatementInfo["kind"] | undefined {
  const { node, parsedSource, importedNames } = opts;
  if (node.moduleSpecifier) {
    return;
  }
  if (!(node.exportClause && isNamedExports(node.exportClause))) {
    return;
  }
  for (const element of node.exportClause.elements) {
    const sourceName = parsedSource.getText({
      node: element.propertyName ?? element.name,
    });
    if (!importedNames.has(sourceName)) {
      return "named-export-local";
    }
  }
}

function classifyExportAssignment(opts: {
  node: ExportAssignment;
  parsedSource: ParsedSource;
  importedNames: Set<string>;
}): NonBarrelStatementInfo["kind"] | undefined {
  const { node, parsedSource, importedNames } = opts;
  if (node.isExportEquals) {
    return "export-equals";
  }
  if (
    isIdentifier(node.expression) &&
    importedNames.has(parsedSource.getText({ node: node.expression }))
  ) {
    return;
  }
  return "default-expression";
}

function isDeclarationNode(node: Node): boolean {
  return (
    isFunctionDeclaration(node) ||
    isClassDeclaration(node) ||
    isInterfaceDeclaration(node) ||
    isTypeAliasDeclaration(node) ||
    isEnumDeclaration(node) ||
    isVariableStatement(node) ||
    isModuleDeclaration(node)
  );
}

function classifyTopLevelNode(opts: {
  node: Node;
  parsedSource: ParsedSource;
  importedNames: Set<string>;
}): NonBarrelStatementInfo["kind"] | undefined {
  const { node, parsedSource, importedNames } = opts;
  if (isImportDeclaration(node)) {
    return;
  }
  if (isExportDeclaration(node)) {
    return classifyExportDeclaration({ importedNames, node, parsedSource });
  }
  if (isExportAssignment(node)) {
    return classifyExportAssignment({ importedNames, node, parsedSource });
  }
  if (isExpressionStatement(node)) {
    return "expression";
  }
  if (isDeclarationNode(node)) {
    return "declaration";
  }
}
