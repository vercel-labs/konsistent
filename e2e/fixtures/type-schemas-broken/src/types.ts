type OtherAuth = { token: string };

type InternalSettings = {
  enabled?: boolean;
  auth?: Readonly<OtherAuth>;
};

export type ModuleSettings = {
  model?: string;
  reasoning?: "low" | "medium" | "high";
};
