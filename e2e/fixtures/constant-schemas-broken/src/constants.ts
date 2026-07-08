const localPort = 3000;

export const mode: "development" = "development";
export const tags: number[] = [1];
export const options: { endpoint: string; retries: number } = {
  endpoint: "https://example.com",
  retries: 3,
};
