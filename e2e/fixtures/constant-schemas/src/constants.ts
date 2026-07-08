const localPort: number = 3000;

export const mode: "development" | "production" = "development";
export const tags: readonly string[] = ["stable"];
export const options: { endpoint: string; metadata?: unknown } = {
  endpoint: "https://example.com",
};
