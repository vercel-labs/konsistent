type InternalSettings = {
  enabled?: boolean;
};

export type ModuleSettings = {
  model?: string;
  timeout?: number;
  reasoning?: "low" | "medium" | "high";
};
