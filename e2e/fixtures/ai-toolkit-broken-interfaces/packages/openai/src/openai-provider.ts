export interface OpenaiProvider extends BaseProvider {
  chat(modelId: string): unknown;
}

export const openai: OpenaiProvider = {} as OpenaiProvider;
