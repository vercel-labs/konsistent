type MyAuth = { token: string };

type InternalSettings = {
  enabled?: boolean;
  auth?: Readonly<MyAuth>;
};

export type ModuleSettings = {
  model?: string;
  timeout?: number;
  reasoning?: "low" | "medium" | "high";
};
