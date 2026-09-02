type OtherAuth = { token: string };
type ModuleSettings<Scope = "local"> = { scope: Scope };

const localPort = 3000;
const localAuths: Readonly<OtherAuth>[] = [];
const localSettings: ModuleSettings = { scope: "local" };

export const settings: ModuleSettings<'internal'> = { scope: "internal" };
export const mode: "development" = "development";
export const tags: number[] = [1];
export const options: { endpoint: string; retries: number } = {
  endpoint: "https://example.com",
  retries: 3,
};
export const optionalOptions: { metadata: unknown } = { metadata: null };
export const authSettings: { auth: OtherAuth; modelId: string } = {
  auth: { token: "secret" },
  modelId: "model",
};
