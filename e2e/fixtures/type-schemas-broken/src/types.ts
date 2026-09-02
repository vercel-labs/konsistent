type OtherAuth = { token: string };
type OtherData = { value: string };
type TypesShared<Scope> = { scope: Scope };

type InternalSettings = {
  enabled?: boolean;
  auth?: Readonly<OtherAuth>;
};

type InternalDataSettings = { data?: OtherData };
type InternalReference = TypesShared<'public'>;

export type ModuleSettings = {
  model?: string;
  reasoning?: "low" | "medium" | "high";
};
export type ModuleReference = TypesShared<'internal'>;
