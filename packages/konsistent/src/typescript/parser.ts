import ts from "typescript";
import { parseConstantTypeAnnotation } from "./constant-type-schema.js";
import type {
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
  sourceFile: ts.SourceFile;
  node: ts.Node;
}): SourcePosition {
  const { line, character } = ts.getLineAndCharacterOfPosition(
    opts.sourceFile,
    opts.node.getStart(opts.sourceFile)
  );
  return { line: line + 1, column: character + 1 };
}

function hasExportModifier(node: ts.Node): boolean {
  return (
    ts.canHaveModifiers(node) &&
    (ts.getModifiers(node) ?? []).some(
      (m) => m.kind === ts.SyntaxKind.ExportKeyword
    )
  );
}

function hasDefaultModifier(node: ts.Node): boolean {
  return (
    ts.canHaveModifiers(node) &&
    (ts.getModifiers(node) ?? []).some(
      (m) => m.kind === ts.SyntaxKind.DefaultKeyword
    )
  );
}

function extractTypeAnnotation(
  node: ts.TypeNode | undefined
): TypeAnnotationInfo | undefined {
  if (!node) {
    return;
  }
  const text = node.getText();
  if (ts.isTypeReferenceNode(node)) {
    return { text, baseName: node.typeName.getText() };
  }
  return { text, baseName: text };
}

function extractParams(
  params: ts.NodeArray<ts.ParameterDeclaration>
): ParamInfo[] {
  return params.map((p) => ({
    name: p.name.getText(),
    typeName: extractTypeAnnotation(p.type),
  }));
}

function extractExtendsFromHeritage(opts: {
  clauses: ts.NodeArray<ts.HeritageClause> | undefined;
  kind: ts.SyntaxKind;
}): ExtendsClauseInfo[] {
  const { clauses, kind } = opts;
  if (!clauses) {
    return [];
  }
  const result: ExtendsClauseInfo[] = [];
  for (const clause of clauses) {
    if (clause.token === kind) {
      for (const type of clause.types) {
        result.push({
          name: type.expression.getText(),
          typeArguments: type.typeArguments
            ? type.typeArguments.map((arg) => arg.getText())
            : [],
        });
      }
    }
  }
  return result;
}

function processExportDeclaration(opts: {
  node: ts.ExportDeclaration;
  sourceFile: ts.SourceFile;
}): ExportInfo[] {
  const { node, sourceFile } = opts;
  const exports: ExportInfo[] = [];
  const isType = node.isTypeOnly;
  const from = node.moduleSpecifier
    ? (node.moduleSpecifier as ts.StringLiteral).text
    : undefined;
  const pos = getPosition({ sourceFile, node });

  if (node.exportClause && ts.isNamedExports(node.exportClause)) {
    for (const element of node.exportClause.elements) {
      exports.push({
        name: (element.propertyName ?? element.name).getText(sourceFile),
        kind: "re-export",
        isType: isType || element.isTypeOnly,
        pos,
        ...(from === undefined ? {} : { from }),
      });
    }
  } else if (!node.exportClause && from) {
    exports.push({
      name: "*",
      kind: "re-export",
      isType,
      from,
      pos,
    });
  }

  return exports;
}

function processNamedExportSymbols(opts: {
  node: ts.ExportDeclaration;
  sourceFile: ts.SourceFile;
}): NamedExportSymbolInfo[] {
  const { node, sourceFile } = opts;
  const symbols: NamedExportSymbolInfo[] = [];
  const from = node.moduleSpecifier
    ? (node.moduleSpecifier as ts.StringLiteral).text
    : undefined;

  if (!(node.exportClause && ts.isNamedExports(node.exportClause))) {
    return symbols;
  }

  for (const element of node.exportClause.elements) {
    symbols.push({
      name: element.name.getText(sourceFile),
      sourceName: (element.propertyName ?? element.name).getText(sourceFile),
      isType: node.isTypeOnly || element.isTypeOnly,
      pos: getPosition({ sourceFile, node: element.name }),
      ...(from === undefined ? {} : { from }),
    });
  }

  return symbols;
}

function processExportedDeclaration(opts: {
  node: ts.Node;
  sourceFile: ts.SourceFile;
}): ExportInfo | undefined {
  const { node, sourceFile } = opts;
  const pos = getPosition({ sourceFile, node });

  if (ts.isFunctionDeclaration(node) && node.name) {
    return {
      name: node.name.getText(sourceFile),
      kind: "function",
      isType: false,
      pos,
    };
  }
  if (ts.isClassDeclaration(node) && node.name) {
    return {
      name: node.name.getText(sourceFile),
      kind: "class",
      isType: false,
      pos,
    };
  }
  if (ts.isInterfaceDeclaration(node)) {
    return {
      name: node.name.getText(sourceFile),
      kind: "interface",
      isType: true,
      pos,
    };
  }
  if (ts.isEnumDeclaration(node)) {
    return {
      name: node.name.getText(sourceFile),
      kind: "enum",
      isType: false,
      pos,
    };
  }
  if (ts.isTypeAliasDeclaration(node)) {
    return {
      name: node.name.getText(sourceFile),
      kind: "interface",
      isType: true,
      pos,
    };
  }
  if (ts.isVariableStatement(node)) {
    const decl = node.declarationList.declarations[0];
    if (decl?.name && ts.isIdentifier(decl.name)) {
      return {
        name: decl.name.getText(sourceFile),
        kind: "const",
        isType: false,
        pos,
      };
    }
  }

  return;
}

interface ParseCollector {
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

function getImportSourceKinds(opts: { node: ts.ImportDeclaration }): {
  hasType: boolean;
  hasValue: boolean;
} {
  const { node } = opts;
  const { importClause } = node;
  if (!importClause) {
    return { hasType: false, hasValue: true };
  }
  if (importClause.isTypeOnly) {
    return { hasType: true, hasValue: false };
  }

  let hasType = false;
  let hasValue = Boolean(importClause.name);
  const { namedBindings } = importClause;

  if (namedBindings) {
    if (ts.isNamespaceImport(namedBindings)) {
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
  node: ts.ImportDeclaration;
  sourceFile: ts.SourceFile;
  collector: ParseCollector;
}): void {
  const { node, sourceFile, collector } = opts;
  const pos = getPosition({ sourceFile, node });
  const moduleSpecifier = (node.moduleSpecifier as ts.StringLiteral).text;
  const isTypeOnly = node.importClause?.isTypeOnly ?? false;
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
    if (ts.isNamedImports(node.importClause.namedBindings)) {
      for (const element of node.importClause.namedBindings.elements) {
        collector.imports.push({
          name: element.name.getText(sourceFile),
          from: moduleSpecifier,
          isType: isTypeOnly || element.isTypeOnly,
          pos,
        });
      }
    } else if (ts.isNamespaceImport(node.importClause.namedBindings)) {
      collector.imports.push({
        name: node.importClause.namedBindings.name.getText(sourceFile),
        from: moduleSpecifier,
        isType: isTypeOnly,
        pos,
      });
    }
  }

  if (node.importClause?.name) {
    collector.imports.push({
      name: node.importClause.name.getText(sourceFile),
      from: moduleSpecifier,
      isType: isTypeOnly,
      pos,
    });
  }
}

function processDeclarationSymbols(opts: {
  node: ts.Node;
  sourceFile: ts.SourceFile;
  collector: ParseCollector;
}): void {
  const { node, sourceFile, collector } = opts;
  const isExported = hasExportModifier(node);
  const isDefaultExport = hasDefaultModifier(node);

  if (ts.isFunctionDeclaration(node) && node.name) {
    collector.declarationSymbols.push({
      name: node.name.getText(sourceFile),
      kind: "function",
      isExported,
      isDefaultExport,
      pos: getPosition({ sourceFile, node: node.name }),
    });
  }

  if (ts.isClassDeclaration(node) && node.name) {
    collector.declarationSymbols.push({
      name: node.name.getText(sourceFile),
      kind: "class",
      isExported,
      isDefaultExport,
      pos: getPosition({ sourceFile, node: node.name }),
    });
  }

  if (ts.isInterfaceDeclaration(node)) {
    collector.declarationSymbols.push({
      name: node.name.getText(sourceFile),
      kind: "interface",
      isExported,
      isDefaultExport,
      pos: getPosition({ sourceFile, node: node.name }),
    });
  }

  if (ts.isTypeAliasDeclaration(node)) {
    collector.declarationSymbols.push({
      name: node.name.getText(sourceFile),
      kind: "type",
      isExported,
      isDefaultExport,
      pos: getPosition({ sourceFile, node: node.name }),
    });
  }

  if (ts.isEnumDeclaration(node)) {
    collector.declarationSymbols.push({
      name: node.name.getText(sourceFile),
      kind: "enum",
      isExported,
      isDefaultExport,
      pos: getPosition({ sourceFile, node: node.name }),
    });
  }

  if (ts.isVariableStatement(node)) {
    // biome-ignore lint/suspicious/noBitwiseOperators: TypeScript NodeFlags is a bitfield enum
    const isConst = (node.declarationList.flags & ts.NodeFlags.Const) !== 0;
    if (!isConst) {
      return;
    }
    for (const decl of node.declarationList.declarations) {
      if (ts.isIdentifier(decl.name)) {
        collector.declarationSymbols.push({
          name: decl.name.getText(sourceFile),
          kind: "const",
          isExported,
          isDefaultExport,
          pos: getPosition({ sourceFile, node: decl.name }),
        });
      }
    }
  }
}

function processVariableStatement(opts: {
  node: ts.VariableStatement;
  sourceFile: ts.SourceFile;
  collector: ParseCollector;
}): void {
  const { node, sourceFile, collector } = opts;
  // biome-ignore lint/suspicious/noBitwiseOperators: TypeScript NodeFlags is a bitfield enum
  const isConst = (node.declarationList.flags & ts.NodeFlags.Const) !== 0;
  if (!isConst) {
    return;
  }
  for (const decl of node.declarationList.declarations) {
    if (ts.isIdentifier(decl.name)) {
      const pos = getPosition({ sourceFile, node });
      collector.constants.push({
        name: decl.name.getText(sourceFile),
        typeInfo: parseConstantTypeAnnotation({ node: decl.type }),
        typeName: extractTypeAnnotation(decl.type),
        pos,
      });
    }
  }
}

function processDeclaration(opts: {
  node: ts.Node;
  sourceFile: ts.SourceFile;
  collector: ParseCollector;
}): void {
  const { node, sourceFile, collector } = opts;

  if (ts.isInterfaceDeclaration(node)) {
    const pos = getPosition({ sourceFile, node });
    collector.interfaces.push({
      name: node.name.getText(sourceFile),
      extends: extractExtendsFromHeritage({
        clauses: node.heritageClauses,
        kind: ts.SyntaxKind.ExtendsKeyword,
      }),
      pos,
    });
  }

  if (ts.isClassDeclaration(node) && node.name) {
    const pos = getPosition({ sourceFile, node });
    const extendsClauses = extractExtendsFromHeritage({
      clauses: node.heritageClauses,
      kind: ts.SyntaxKind.ExtendsKeyword,
    });
    const implementsClauses = extractExtendsFromHeritage({
      clauses: node.heritageClauses,
      kind: ts.SyntaxKind.ImplementsKeyword,
    });
    collector.classes.push({
      name: node.name.getText(sourceFile),
      extends: extendsClauses[0]?.name,
      implements: implementsClauses.map((c) => c.name),
      pos,
    });
  }

  if (ts.isFunctionDeclaration(node) && node.name) {
    const pos = getPosition({ sourceFile, node });
    collector.functions.push({
      name: node.name.getText(sourceFile),
      params: extractParams(node.parameters),
      returnType: extractTypeAnnotation(node.type),
      pos,
    });
  }

  if (ts.isVariableStatement(node)) {
    processVariableStatement({ node, sourceFile, collector });
  }

  if (ts.isTypeAliasDeclaration(node)) {
    const pos = getPosition({ sourceFile, node });
    collector.typeAliases.push({
      name: node.name.getText(sourceFile),
      pos,
    });
  }
}

function processExportModifier(opts: {
  node: ts.Node;
  sourceFile: ts.SourceFile;
  collector: ParseCollector;
}): void {
  const { node, sourceFile, collector } = opts;
  if (hasDefaultModifier(node)) {
    const pos = getPosition({ sourceFile, node });
    collector.exports.push({
      name: "default",
      kind: "const",
      isType: false,
      pos,
    });
  } else {
    const exportInfo = processExportedDeclaration({ node, sourceFile });
    if (exportInfo) {
      collector.exports.push(exportInfo);
    }
  }
}

export function parseFileStructure(opts: {
  source: string;
  filePath?: string;
}): FileStructure {
  const sourceFile = ts.createSourceFile(
    opts.filePath ?? "unknown.ts",
    opts.source,
    ts.ScriptTarget.Latest,
    true
  );

  const collector: ParseCollector = {
    exports: [],
    imports: [],
    importSources: [],
    interfaces: [],
    classes: [],
    functions: [],
    constants: [],
    declarationSymbols: [],
    namedExportSymbols: [],
    defaultExportSymbols: [],
    nonBarrelStatements: [],
    typeAliases: [],
  };

  ts.forEachChild(sourceFile, (node) => {
    if (ts.isExportDeclaration(node)) {
      collector.exports.push(...processExportDeclaration({ node, sourceFile }));
      collector.namedExportSymbols.push(
        ...processNamedExportSymbols({ node, sourceFile })
      );
      return;
    }

    if (ts.isExportAssignment(node)) {
      const pos = getPosition({ sourceFile, node });
      collector.exports.push({
        name: "default",
        kind: "const",
        isType: false,
        pos,
      });
      if (!node.isExportEquals && ts.isIdentifier(node.expression)) {
        collector.defaultExportSymbols.push({
          name: node.expression.getText(sourceFile),
          pos: getPosition({ sourceFile, node: node.expression }),
        });
      }
      return;
    }

    if (ts.isImportDeclaration(node)) {
      processImportDeclaration({ node, sourceFile, collector });
      return;
    }

    processDeclaration({ node, sourceFile, collector });
    processDeclarationSymbols({ node, sourceFile, collector });

    if (hasExportModifier(node)) {
      processExportModifier({ node, sourceFile, collector });
    }
  });

  classifyNonBarrelStatements({ sourceFile, collector });

  return collector;
}

function classifyNonBarrelStatements(opts: {
  sourceFile: ts.SourceFile;
  collector: ParseCollector;
}): void {
  const { sourceFile, collector } = opts;
  const importedNames = new Set(collector.imports.map((i) => i.name));

  ts.forEachChild(sourceFile, (node) => {
    const kind = classifyTopLevelNode({ node, sourceFile, importedNames });
    if (kind) {
      collector.nonBarrelStatements.push({
        kind,
        pos: getPosition({ sourceFile, node }),
      });
    }
  });
}

function classifyExportDeclaration(opts: {
  node: ts.ExportDeclaration;
  sourceFile: ts.SourceFile;
  importedNames: Set<string>;
}): NonBarrelStatementInfo["kind"] | undefined {
  const { node, sourceFile, importedNames } = opts;
  if (node.moduleSpecifier) {
    return;
  }
  if (!(node.exportClause && ts.isNamedExports(node.exportClause))) {
    return;
  }
  for (const element of node.exportClause.elements) {
    const sourceName = (element.propertyName ?? element.name).getText(
      sourceFile
    );
    if (!importedNames.has(sourceName)) {
      return "named-export-local";
    }
  }
  return;
}

function classifyExportAssignment(opts: {
  node: ts.ExportAssignment;
  sourceFile: ts.SourceFile;
  importedNames: Set<string>;
}): NonBarrelStatementInfo["kind"] | undefined {
  const { node, sourceFile, importedNames } = opts;
  if (node.isExportEquals) {
    return "export-equals";
  }
  if (
    ts.isIdentifier(node.expression) &&
    importedNames.has(node.expression.getText(sourceFile))
  ) {
    return;
  }
  return "default-expression";
}

function isDeclarationNode(node: ts.Node): boolean {
  return (
    ts.isFunctionDeclaration(node) ||
    ts.isClassDeclaration(node) ||
    ts.isInterfaceDeclaration(node) ||
    ts.isTypeAliasDeclaration(node) ||
    ts.isEnumDeclaration(node) ||
    ts.isVariableStatement(node) ||
    ts.isModuleDeclaration(node)
  );
}

function classifyTopLevelNode(opts: {
  node: ts.Node;
  sourceFile: ts.SourceFile;
  importedNames: Set<string>;
}): NonBarrelStatementInfo["kind"] | undefined {
  const { node, sourceFile, importedNames } = opts;
  if (ts.isImportDeclaration(node)) {
    return;
  }
  if (ts.isExportDeclaration(node)) {
    return classifyExportDeclaration({ node, sourceFile, importedNames });
  }
  if (ts.isExportAssignment(node)) {
    return classifyExportAssignment({ node, sourceFile, importedNames });
  }
  if (ts.isExpressionStatement(node)) {
    return "expression";
  }
  if (isDeclarationNode(node)) {
    return "declaration";
  }
  return;
}
