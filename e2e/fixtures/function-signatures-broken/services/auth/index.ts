export interface Options {
  apiKey: string;
}
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
  logger: Options,
  retryCount: number
): AuthService {
  logger.apiKey;
  retryCount;
  return { authenticate: async () => {} };
}
