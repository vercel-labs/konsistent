import type { ProviderV1 } from '@ai-toolkit/core';

export interface AnthropicProvider extends ProviderV1 {
  messages(modelId: string): unknown;
}

export const anthropic: AnthropicProvider = {} as AnthropicProvider;
