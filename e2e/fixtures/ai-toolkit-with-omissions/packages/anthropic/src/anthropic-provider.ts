import type { ProviderV1 } from '@ai-toolkit/core';

export interface AnthropicProvider extends Omit<ProviderV1, 'legacy'> {
  messages(modelId: string): unknown;
}

export const anthropic: AnthropicProvider = {} as AnthropicProvider;
