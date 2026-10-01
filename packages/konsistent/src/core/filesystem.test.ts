import { describe, expect, it, vi } from "vitest";
import { createRealFileSystem } from "./filesystem.js";

vi.mock("tinyglobby", async (importOriginal) => ({
  ...(await importOriginal<typeof import("tinyglobby")>()),
  glob: vi.fn().mockResolvedValue(["src/index.ts"]),
  globSync: vi.fn().mockReturnValue([]),
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

describe("createRealFileSystem file pattern matching", () => {
  it("keeps exact files and directories without running a glob", async () => {
    const { globSync } = await import("tinyglobby");
    const spy = vi.mocked(globSync);
    spy.mockClear();

    const fs = createRealFileSystem({ cwd: import.meta.dirname });
    expect(fs.fileExists("filesystem.ts")).toBe(true);
    expect(fs.fileExists("../predicates")).toBe(true);
    expect(fs.fileExists("not-present.ts")).toBe(false);
    expect(spy).not.toHaveBeenCalled();
  });

  it("checks a dynamic pattern for at least one file", async () => {
    const { globSync } = await import("tinyglobby");
    const spy = vi.mocked(globSync);
    spy.mockReset().mockReturnValue(["instructions/guide.md"]);

    const fs = createRealFileSystem({ cwd: "/fake" });
    expect(fs.fileExists("instructions/*.{md,ts}")).toBe(true);
    expect(spy).toHaveBeenCalledWith({
      patterns: "instructions/*.{md,ts}",
      cwd: "/fake",
      expandDirectories: false,
      onlyFiles: true,
    });
  });

  it("caches both matching and missing patterns independently", async () => {
    const { globSync } = await import("tinyglobby");
    const spy = vi.mocked(globSync);
    spy.mockReset().mockReturnValueOnce([]).mockReturnValueOnce(["found.ts"]);

    const fs = createRealFileSystem({ cwd: "/fake" });
    expect(fs.fileExists("missing/*.ts")).toBe(false);
    expect(fs.fileExists("missing/*.ts")).toBe(false);
    expect(fs.fileExists("found/*.{md,ts}")).toBe(true);
    expect(fs.fileExists("found/*.{md,ts}")).toBe(true);
    expect(spy).toHaveBeenCalledTimes(2);
  });
});

describe("createRealFileSystem directory pattern matching", () => {
  it("matches exact directories but not files without running a glob", async () => {
    const { globSync } = await import("tinyglobby");
    const spy = vi.mocked(globSync);
    spy.mockClear();

    const fs = createRealFileSystem({ cwd: import.meta.dirname });
    expect(fs.directoryExists("../predicates")).toBe(true);
    expect(fs.directoryExists("filesystem.ts")).toBe(false);
    expect(fs.directoryExists("not-present")).toBe(false);
    expect(spy).not.toHaveBeenCalled();
  });

  it("checks dynamic patterns only for matching directories", async () => {
    const { globSync } = await import("tinyglobby");
    const spy = vi.mocked(globSync);
    spy.mockReset().mockReturnValue(["src/modules/foo"]);

    const fs = createRealFileSystem({ cwd: "/fake" });
    expect(fs.directoryExists("src/modules/*")).toBe(true);
    expect(spy).toHaveBeenCalledWith({
      patterns: "src/modules/*",
      cwd: "/fake",
      expandDirectories: false,
      onlyDirectories: true,
    });
  });

  it("caches matching and missing directory patterns independently", async () => {
    const { globSync } = await import("tinyglobby");
    const spy = vi.mocked(globSync);
    spy.mockReset().mockReturnValueOnce([]).mockReturnValueOnce(["src/api"]);

    const fs = createRealFileSystem({ cwd: "/fake" });
    expect(fs.directoryExists("src/missing/*")).toBe(false);
    expect(fs.directoryExists("src/missing/*")).toBe(false);
    expect(fs.directoryExists("src/a*")).toBe(true);
    expect(fs.directoryExists("src/a*")).toBe(true);
    expect(spy).toHaveBeenCalledTimes(2);
  });
});
