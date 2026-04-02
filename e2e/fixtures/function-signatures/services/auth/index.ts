export interface AuthConfig {
  apiKey: string;
}
export interface AuthService {
  authenticate(): Promise<void>;
}
export function createAuthService(config: AuthConfig): AuthService {
  return { authenticate: async () => {} };
}
