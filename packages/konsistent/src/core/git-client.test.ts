import { describe, expect, it, vi } from "vitest";
import type { FileSystem } from "./filesystem.js";
import { createGitClient, parseNullDelimitedPaths } from "./git-client.js";

function createMockFileSystem(files: string[]): FileSystem {
  const paths = new Set(files);
  return {
    fileExists: (path) => paths.has(path),
    glob: () => Promise.resolve([]),
    isDirectory: () => false,
    isFile: (path) => paths.has(path),
    readDir: () => [],
    readFile: () => "",
  };
}

describe("parseNullDelimitedPaths", () => {
  it("preserves spaces and newlines in paths", () => {
    expect(
      parseNullDelimitedPaths(
        Buffer.from("src/with space.ts\0src/with\nnewline.ts\0")
      )
    ).toEqual(["src/with space.ts", "src/with\nnewline.ts"]);
  });
});

describe("createGitClient", () => {
  it("lists staged regular files with Biome-compatible status filtering", async () => {
    const runGit = vi.fn((opts: { args: string[]; cwd: string }) => {
      if (opts.args[0] === "rev-parse") {
        return Promise.resolve(Buffer.from("true\n"));
      }
      return Promise.resolve(
        Buffer.from("src/a.ts\0src/deleted.ts\0src/with space.ts\0")
      );
    });
    const client = createGitClient({
      cwd: "/repo",
      fileSystem: createMockFileSystem(["src/a.ts", "src/with space.ts"]),
      runGit,
    });

    await expect(client.listStagedPaths()).resolves.toEqual([
      "src/a.ts",
      "src/with space.ts",
    ]);
    expect(runGit).toHaveBeenNthCalledWith(1, {
      args: ["rev-parse", "--is-inside-work-tree"],
      cwd: "/repo",
    });
    expect(runGit).toHaveBeenNthCalledWith(2, {
      args: [
        "diff",
        "--name-only",
        "--relative",
        "-z",
        "--cached",
        "--diff-filter=ACMR",
        "--",
      ],
      cwd: "/repo",
    });
  });

  it("unions staged, unstaged, and untracked modified paths", async () => {
    const runGit = vi.fn((opts: { args: string[]; cwd: string }) => {
      if (opts.args[0] === "rev-parse") {
        return Promise.resolve(Buffer.from("true\n"));
      }
      if (opts.args[0] === "ls-files") {
        return Promise.resolve(Buffer.from("src/untracked.ts\0"));
      }
      if (opts.args.includes("--cached")) {
        return Promise.resolve(Buffer.from("src/staged.ts\0src/shared.ts\0"));
      }
      return Promise.resolve(Buffer.from("src/unstaged.ts\0src/shared.ts\0"));
    });
    const client = createGitClient({
      cwd: "/repo",
      fileSystem: createMockFileSystem([
        "src/shared.ts",
        "src/staged.ts",
        "src/unstaged.ts",
        "src/untracked.ts",
      ]),
      runGit,
    });

    await expect(client.listModifiedPaths()).resolves.toEqual([
      "src/shared.ts",
      "src/staged.ts",
      "src/unstaged.ts",
      "src/untracked.ts",
    ]);
    expect(runGit).toHaveBeenCalledTimes(4);
    expect(runGit).toHaveBeenCalledWith({
      args: ["ls-files", "--others", "--exclude-standard", "-z", "--"],
      cwd: "/repo",
    });
  });

  it("caches repository validation and propagates Git errors", async () => {
    const runGit = vi
      .fn<(opts: { args: string[]; cwd: string }) => Promise<Buffer>>()
      .mockResolvedValueOnce(Buffer.from("true\n"))
      .mockResolvedValueOnce(Buffer.alloc(0))
      .mockRejectedValueOnce(new Error("fatal: not a git repository"));
    const client = createGitClient({
      cwd: "/repo",
      fileSystem: createMockFileSystem([]),
      runGit,
    });

    await expect(client.listStagedPaths()).resolves.toEqual([]);
    await expect(client.listStagedPaths()).rejects.toThrow(
      "fatal: not a git repository"
    );
    expect(
      runGit.mock.calls.filter(([opts]) => opts.args[0] === "rev-parse")
    ).toHaveLength(1);
  });
});
