type OtherAuth = { token: string };
type OtherData = { value: string };

type InternalSettings = {
  enabled?: boolean;
  auth?: Readonly<OtherAuth>;
};

type InternalDataSettings = { data?: OtherData };

export type ModuleSettings = {
  model?: string;
  reasoning?: "low" | "medium" | "high";
};
