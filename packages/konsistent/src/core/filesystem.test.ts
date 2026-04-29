import { describe, expect, it, vi } from "vitest";
import { createRealFileSystem } from "./filesystem.js";

vi.mock("tinyglobby", () => ({
  glob: vi.fn().mockResolvedValue(["src/index.ts"]),
}));

describe("createRealFileSystem glob caching", () => {
  it("resolves the same glob pattern only once", async () => {
    const { glob: mockGlob } = await import("tinyglobby");
    const spy = vi.mocked(mockGlob);
    spy.mockClear();

    const fs = createRealFileSystem({ cwd: "/fake" });
    await fs.glob(["src/**/*.ts"]);
    await fs.glob(["src/**/*.ts"]);
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it("resolves different glob patterns separately", async () => {
    const { glob: mockGlob } = await import("tinyglobby");
    const spy = vi.mocked(mockGlob);
    spy.mockClear();

    const fs = createRealFileSystem({ cwd: "/fake" });
    await fs.glob(["src/**/*.ts"]);
    await fs.glob(["lib/**/*.ts"]);
    expect(spy).toHaveBeenCalledTimes(2);
  });
});
