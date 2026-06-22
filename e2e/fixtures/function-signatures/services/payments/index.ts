export interface PaymentsConfig<T> {
  apiKey: string;
  client: T;
}
export interface PaymentsService<T> {
  client: T;
  charge(): Promise<void>;
}
export interface PaymentsLogger {
  info(message: string): void;
}
export function createPaymentsService(
  config: PaymentsConfig<string>,
  logger: PaymentsLogger,
  timeoutMs: number
): PaymentsService<string> {
  logger.info(`payments timeout: ${timeoutMs}`);
  return { client: config.client, charge: async () => {} };
}
