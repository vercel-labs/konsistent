export interface SourcePosition {
  column: number;
  line: number;
}

export interface ExportInfo {
  from?: string;
  isType: boolean;
  kind: "function" | "class" | "interface" | "const" | "enum" | "re-export";
  name: string;
  pos: SourcePosition;
}

export interface ImportInfo {
  from: string;
  isType: boolean;
  kind: "default" | "named" | "namespace";
  name: string;
  pos: SourcePosition;
  sourceName?: string;
}

export type DeclarationSymbolKind =
  | "function"
  | "class"
  | "interface"
  | "type"
  | "const"
  | "enum";

export interface DeclarationSymbolInfo {
  isDefaultExport: boolean;
  isExported: boolean;
  kind: DeclarationSymbolKind;
  name: string;
  pos: SourcePosition;
}

export interface NamedExportSymbolInfo {
  from?: string;
  isType: boolean;
  name: string;
  pos: SourcePosition;
  sourceName: string;
}

export interface DefaultExportSymbolInfo {
  name: string;
  pos: SourcePosition;
}

export interface ImportSourceInfo {
  from: string;
  isType: boolean;
  pos: SourcePosition;
}

export interface ExtendsClauseInfo {
  name: string;
  typeArguments: string[];
}

export interface TypeAnnotationInfo {
  baseName: string;
  text: string;
}

export interface InterfaceInfo {
  extends: ExtendsClauseInfo[];
  name: string;
  pos: SourcePosition;
  typeInfo?: TypeShapeInfo;
}

export interface ClassInfo {
  extends?: string;
  implements: string[];
  name: string;
  pos: SourcePosition;
}

export interface ParamInfo {
  name: string;
  typeName?: TypeAnnotationInfo;
}

export interface FunctionInfo {
  name: string;
  params: ParamInfo[];
  pos: SourcePosition;
  returnType?: TypeAnnotationInfo;
}

export interface ConstantInfo {
  name: string;
  pos: SourcePosition;
  typeInfo?: ConstantTypeInfo;
  typeName?: TypeAnnotationInfo;
}

export interface TypeAliasInfo {
  name: string;
  pos: SourcePosition;
  typeInfo?: TypeShapeInfo;
}

export type NonBarrelStatementKind =
  | "declaration"
  | "expression"
  | "default-expression"
  | "named-export-local"
  | "export-equals";

export interface NonBarrelStatementInfo {
  kind: NonBarrelStatementKind;
  pos: SourcePosition;
}

export interface FileStructure {
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

import type {
  ConstantTypeInfo,
  TypeShapeInfo,
} from "./constant-type-schema.js";
