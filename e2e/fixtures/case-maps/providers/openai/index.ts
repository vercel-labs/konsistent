export type OpenAIProviderConfig = {
  apiKey: string;
};

export const OPENAI_PROVIDER_ID = "openai";

export function createOpenAIProvider(config: OpenAIProviderConfig): unknown {
  return config;
}
