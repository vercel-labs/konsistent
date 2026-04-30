export interface PaymentsConfig<T> {
  apiKey: string;
  client: T;
}
export interface PaymentsService<T> {
  client: T;
  charge(): Promise<void>;
}
export function createPaymentsService(
  config: PaymentsConfig<string>
): PaymentsService<string> {
  return { client: config.client, charge: async () => {} };
}
