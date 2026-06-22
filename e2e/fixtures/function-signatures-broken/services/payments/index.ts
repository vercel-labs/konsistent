export interface PaymentsConfig {
  apiKey: string;
}
export interface PaymentsService {
  charge(): Promise<void>;
}
export interface PaymentsLogger {
  info(message: string): void;
}
export function createPaymentsService(
  config: PaymentsConfig,
  logger: PaymentsLogger
): any {
  logger.info(config.apiKey);
  return { charge: async () => {} };
}
