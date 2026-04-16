export type OpenaiProviderConfig = {
  apiKey: string;
};

export function createOpenaiProvider(config: OpenaiProviderConfig): unknown {
  return config;
}
