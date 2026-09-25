type MyAuth = { token: string };
type TypesData = { value: string };
type TypesShared<Scope> = { scope: Scope };
type Prettify<T> = { [K in keyof T]: T[K] } & {};

type InternalSettings = {
  enabled?: boolean;
  auth?: Readonly<MyAuth>;
};

type InternalDataSettings = { data?: TypesData };
type InternalReference = TypesShared<'internal'>;
type InternalNetworkOptions = Prettify<
  TypesShared<'internal'> & {
    sandbox?: never;
  }
>;

export type ModuleSettings = {
  model?: string;
  timeout?: number;
  reasoning?: "low" | "medium" | "high";
};
export type ModuleReference = TypesShared<'public'>;
export type ModuleNetworkOptions = Prettify<
  TypesShared<'public'> & {
    sandbox?: never;
  }
>;
