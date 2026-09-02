type MyAuth = { token: string };
type TypesData = { value: string };
type TypesShared<Scope> = { scope: Scope };

type InternalSettings = {
  enabled?: boolean;
  auth?: Readonly<MyAuth>;
};

type InternalDataSettings = { data?: TypesData };
type InternalReference = TypesShared<'internal'>;

export type ModuleSettings = {
  model?: string;
  timeout?: number;
  reasoning?: "low" | "medium" | "high";
};
export type ModuleReference = TypesShared<'public'>;
