type MyAuth = { token: string };
type TypesData = { value: string };

type InternalSettings = {
  enabled?: boolean;
  auth?: Readonly<MyAuth>;
};

type InternalDataSettings = { data?: TypesData };

export type ModuleSettings = {
  model?: string;
  timeout?: number;
  reasoning?: "low" | "medium" | "high";
};
