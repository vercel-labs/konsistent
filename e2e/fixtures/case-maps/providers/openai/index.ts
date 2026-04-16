export type OpenAIProviderConfig = {
  apiKey: string;
};

export function createOpenAIProvider(config: OpenAIProviderConfig): unknown {
  return config;
}
