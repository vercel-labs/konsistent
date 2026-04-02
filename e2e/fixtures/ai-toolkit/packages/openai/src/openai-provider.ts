import type { ProviderV1 } from '@ai-toolkit/core';

export interface OpenaiProvider extends ProviderV1 {
  chat(modelId: string): unknown;
}

export const openai: OpenaiProvider = {} as OpenaiProvider;
