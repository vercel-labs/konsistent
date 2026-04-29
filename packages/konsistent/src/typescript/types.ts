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
  name: string;
  pos: SourcePosition;
}

export interface ExtendsClauseInfo {
  name: string;
  typeArguments: string[];
}

export interface InterfaceInfo {
  extends: ExtendsClauseInfo[];
  name: string;
  pos: SourcePosition;
}

export interface ClassInfo {
  extends?: string;
  implements: string[];
  name: string;
  pos: SourcePosition;
}

export interface ParamInfo {
  name: string;
  typeName?: string;
}

export interface FunctionInfo {
  name: string;
  params: ParamInfo[];
  pos: SourcePosition;
  returnType?: string;
}

export interface ConstantInfo {
  name: string;
  pos: SourcePosition;
  typeName?: string;
}

export interface TypeAliasInfo {
  name: string;
  pos: SourcePosition;
}

export interface FileStructure {
  classes: ClassInfo[];
  constants: ConstantInfo[];
  exports: ExportInfo[];
  functions: FunctionInfo[];
  imports: ImportInfo[];
  interfaces: InterfaceInfo[];
  typeAliases: TypeAliasInfo[];
}
