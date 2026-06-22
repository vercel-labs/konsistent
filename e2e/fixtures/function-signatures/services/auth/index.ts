export interface AuthConfig {
  apiKey: string;
}
export interface AuthService {
  authenticate(): Promise<void>;
}
export interface AuthLogger {
  info(message: string): void;
}
export function createAuthService(
  config: AuthConfig,
  logger: AuthLogger,
  retryCount: number
): AuthService {
  logger.info(`auth retries: ${retryCount}`);
  return { authenticate: async () => {} };
}
