export interface SourcePosition {
  line: number;
  column: number;
}

export interface ExportInfo {
  name: string;
  kind: 'function' | 'class' | 'interface' | 'const' | 'enum' | 're-export';
  from?: string;
  isType: boolean;
  pos: SourcePosition;
}

export interface ImportInfo {
  name: string;
  from: string;
  isType: boolean;
  pos: SourcePosition;
}

export interface InterfaceInfo {
  name: string;
  extends: string[];
  pos: SourcePosition;
}

export interface ClassInfo {
  name: string;
  extends?: string;
  pos: SourcePosition;
}

export interface ParamInfo {
  name: string;
  typeName?: string;
}

export interface FunctionInfo {
  name: string;
  params: ParamInfo[];
  returnType?: string;
  pos: SourcePosition;
}

export interface ConstantInfo {
  name: string;
  typeName?: string;
  pos: SourcePosition;
}

export interface TypeAliasInfo {
  name: string;
  pos: SourcePosition;
}

export interface FileStructure {
  exports: ExportInfo[];
  imports: ImportInfo[];
  interfaces: InterfaceInfo[];
  classes: ClassInfo[];
  functions: FunctionInfo[];
  constants: ConstantInfo[];
  typeAliases: TypeAliasInfo[];
}
