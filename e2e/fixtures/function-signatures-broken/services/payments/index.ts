export interface PaymentsConfig {
  apiKey: string;
}
export interface PaymentsService {
  charge(): Promise<void>;
}
export function createPaymentsService(config: PaymentsConfig): any {
  return { charge: async () => {} };
}
