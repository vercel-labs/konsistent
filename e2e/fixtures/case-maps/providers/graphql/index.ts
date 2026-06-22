export type GraphQLProviderConfig = {
  endpoint: string;
};

export const GRAPHQL_PROVIDER_ID = "graphql";

export function createGraphQLProvider(config: GraphQLProviderConfig): unknown {
  return config;
}
