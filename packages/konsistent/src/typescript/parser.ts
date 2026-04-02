import ts from 'typescript';
import type {
  ClassInfo,
  ConstantInfo,
  ExportInfo,
  FileStructure,
  FunctionInfo,
  ImportInfo,
  InterfaceInfo,
  ParamInfo,
  SourcePosition,
  TypeAliasInfo,
} from './types.js';

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
): string | undefined {
  if (!node) return undefined;
  return node.getText();
}

function extractParams(
  params: ts.NodeArray<ts.ParameterDeclaration>
): ParamInfo[] {
  return params.map((p) => ({
    name: p.name.getText(),
    typeName: extractTypeAnnotation(p.type),
  }));
}

function extractExtendsFromHeritage(
  clauses: ts.NodeArray<ts.HeritageClause> | undefined,
  kind: ts.SyntaxKind
): string[] {
  if (!clauses) return [];
  const result: string[] = [];
  for (const clause of clauses) {
    if (clause.token === kind) {
      for (const type of clause.types) {
        result.push(type.expression.getText());
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
        kind: 're-export',
        isType: isType || element.isTypeOnly,
        pos,
        ...(from !== undefined ? { from } : {}),
      });
    }
  } else if (!node.exportClause && from) {
    exports.push({
      name: '*',
      kind: 're-export',
      isType,
      from,
      pos,
    });
  }

  return exports;
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
      kind: 'function',
      isType: false,
      pos,
    };
  }
  if (ts.isClassDeclaration(node) && node.name) {
    return {
      name: node.name.getText(sourceFile),
      kind: 'class',
      isType: false,
      pos,
    };
  }
  if (ts.isInterfaceDeclaration(node)) {
    return {
      name: node.name.getText(sourceFile),
      kind: 'interface',
      isType: true,
      pos,
    };
  }
  if (ts.isEnumDeclaration(node)) {
    return {
      name: node.name.getText(sourceFile),
      kind: 'enum',
      isType: false,
      pos,
    };
  }
  if (ts.isTypeAliasDeclaration(node)) {
    return {
      name: node.name.getText(sourceFile),
      kind: 'interface',
      isType: true,
      pos,
    };
  }
  if (ts.isVariableStatement(node)) {
    const decl = node.declarationList.declarations[0];
    if (decl?.name && ts.isIdentifier(decl.name)) {
      return {
        name: decl.name.getText(sourceFile),
        kind: 'const',
        isType: false,
        pos,
      };
    }
  }

  return undefined;
}

export function parseFileStructure(opts: {
  source: string;
  filePath?: string;
}): FileStructure {
  const sourceFile = ts.createSourceFile(
    opts.filePath ?? 'unknown.ts',
    opts.source,
    ts.ScriptTarget.Latest,
    true
  );

  const exports: ExportInfo[] = [];
  const imports: ImportInfo[] = [];
  const interfaces: InterfaceInfo[] = [];
  const classes: ClassInfo[] = [];
  const functions: FunctionInfo[] = [];
  const constants: ConstantInfo[] = [];
  const typeAliases: TypeAliasInfo[] = [];

  ts.forEachChild(sourceFile, (node) => {
    if (ts.isExportDeclaration(node)) {
      exports.push(...processExportDeclaration({ node, sourceFile }));
      return;
    }

    if (ts.isExportAssignment(node)) {
      const pos = getPosition({ sourceFile, node });
      exports.push({
        name: 'default',
        kind: 'const',
        isType: false,
        pos,
      });
      return;
    }

    if (ts.isImportDeclaration(node)) {
      const pos = getPosition({ sourceFile, node });
      const moduleSpecifier = (node.moduleSpecifier as ts.StringLiteral).text;
      const isTypeOnly = node.importClause?.isTypeOnly ?? false;

      if (node.importClause?.namedBindings) {
        if (ts.isNamedImports(node.importClause.namedBindings)) {
          for (const element of node.importClause.namedBindings.elements) {
            imports.push({
              name: element.name.getText(sourceFile),
              from: moduleSpecifier,
              isType: isTypeOnly || element.isTypeOnly,
              pos,
            });
          }
        } else if (ts.isNamespaceImport(node.importClause.namedBindings)) {
          imports.push({
            name: node.importClause.namedBindings.name.getText(sourceFile),
            from: moduleSpecifier,
            isType: isTypeOnly,
            pos,
          });
        }
      }

      if (node.importClause?.name) {
        imports.push({
          name: node.importClause.name.getText(sourceFile),
          from: moduleSpecifier,
          isType: isTypeOnly,
          pos,
        });
      }

      return;
    }

    if (ts.isInterfaceDeclaration(node)) {
      const pos = getPosition({ sourceFile, node });
      const extendsNames = extractExtendsFromHeritage(
        node.heritageClauses,
        ts.SyntaxKind.ExtendsKeyword
      );
      interfaces.push({
        name: node.name.getText(sourceFile),
        extends: extendsNames,
        pos,
      });
    }

    if (ts.isClassDeclaration(node) && node.name) {
      const pos = getPosition({ sourceFile, node });
      const extendsNames = extractExtendsFromHeritage(
        node.heritageClauses,
        ts.SyntaxKind.ExtendsKeyword
      );
      classes.push({
        name: node.name.getText(sourceFile),
        extends: extendsNames[0],
        pos,
      });
    }

    if (ts.isFunctionDeclaration(node) && node.name) {
      const pos = getPosition({ sourceFile, node });
      functions.push({
        name: node.name.getText(sourceFile),
        params: extractParams(node.parameters),
        returnType: extractTypeAnnotation(node.type),
        pos,
      });
    }

    if (ts.isVariableStatement(node)) {
      const isConst = (node.declarationList.flags & ts.NodeFlags.Const) !== 0;
      if (isConst) {
        for (const decl of node.declarationList.declarations) {
          if (ts.isIdentifier(decl.name)) {
            const pos = getPosition({ sourceFile, node });
            constants.push({
              name: decl.name.getText(sourceFile),
              typeName: extractTypeAnnotation(decl.type),
              pos,
            });
          }
        }
      }
    }

    if (ts.isTypeAliasDeclaration(node)) {
      const pos = getPosition({ sourceFile, node });
      typeAliases.push({
        name: node.name.getText(sourceFile),
        pos,
      });
    }

    if (hasExportModifier(node)) {
      if (hasDefaultModifier(node)) {
        const pos = getPosition({ sourceFile, node });
        exports.push({
          name: 'default',
          kind: 'const',
          isType: false,
          pos,
        });
      } else {
        const exportInfo = processExportedDeclaration({ node, sourceFile });
        if (exportInfo) {
          exports.push(exportInfo);
        }
      }
    }
  });

  return {
    exports,
    imports,
    interfaces,
    classes,
    functions,
    constants,
    typeAliases,
  };
}
