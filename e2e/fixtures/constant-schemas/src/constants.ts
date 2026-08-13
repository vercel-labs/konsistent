type MyAuth = { token: string };

const localPort: number = 3000;
const localAuths: ReadonlyArray<Readonly<MyAuth>> = [];

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
