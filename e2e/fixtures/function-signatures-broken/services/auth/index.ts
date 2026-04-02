export interface Options {
  apiKey: string;
}
export interface AuthService {
  authenticate(): Promise<void>;
}
export function createAuthService(config: Options): AuthService {
  return { authenticate: async () => {} };
}
