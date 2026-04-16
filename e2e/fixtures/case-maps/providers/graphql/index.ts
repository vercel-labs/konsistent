export type GraphQLProviderConfig = {
  endpoint: string;
};

export function createGraphQLProvider(config: GraphQLProviderConfig): unknown {
  return config;
}
