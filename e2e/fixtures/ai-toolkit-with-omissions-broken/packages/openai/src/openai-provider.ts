import type { ProviderV1 } from '@ai-toolkit/core';

export interface OpenaiProvider extends Pick<ProviderV1, 'chat'> {
  completions(modelId: string): unknown;
}

export const openai: OpenaiProvider = {} as OpenaiProvider;
