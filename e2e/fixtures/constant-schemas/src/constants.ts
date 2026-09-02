type MyAuth = { token: string };
type ModuleSettings<Scope = "local"> = { scope: Scope };

const localPort: number = 3000;
const localAuths: ReadonlyArray<Readonly<MyAuth>> = [];
const localSettings: Readonly<ModuleSettings> = { scope: "local" };

export const settings: ModuleSettings<'public'> = { scope: "public" };
export const mode: "development" | "production" = "development";
export const tags: readonly string[] = ["stable"];
export const options: { endpoint: string; metadata?: unknown } = {
  endpoint: "https://example.com",
};
export const optionalOptions: { metadata?: unknown } = {};
export const authSettings: {
  auth: Readonly<MyAuth>;
  modelId: string;
} = {
  auth: { token: "secret" },
  modelId: "model",
};
