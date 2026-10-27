import { API } from "typescript/unstable/sync";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createTypeScriptSession,
  TypeScriptRuntimeError,
  type TypeScriptSession,
} from "../typescript/native-session.js";
import { createFileStructureLoader } from "./file-structure-loader.js";
import type { FileSystem } from "./filesystem.js";

function createFileSystem(opts: { contents: Record<string, string> }) {
  const readFile = vi.fn((path: string) => {
    const content = opts.contents[path];
    if (content === undefined) {
      throw new Error(`Cannot read ${path}`);
    }
    return content;
  });
  const fileSystem: FileSystem = {
    directoryExists: () => false,
    fileExists: () => false,
    glob: () => Promise.resolve([]),
    isDirectory: () => false,
    isFile: () => true,
    readDir: () => [],
    readFile,
  };
  return { fileSystem, readFile };
}

describe("createFileStructureLoader", () => {
  let session: TypeScriptSession | undefined;

  afterEach(() => {
    session?.close();
    session = undefined;
    vi.restoreAllMocks();
  });

  function setup(opts: { contents: Record<string, string> }) {
    session = createTypeScriptSession();
    const update = vi.spyOn(API.prototype, "updateSnapshot");
    const { fileSystem, readFile } = createFileSystem(opts);
    const loader = createFileStructureLoader({ fileSystem, session });
    return { loader, readFile, update };
  }

  it("parses loads requested in the same tick with one snapshot update", async () => {
    const { loader, update } = setup({
      contents: {
        "src/a.ts": "export const a = 1;",
        "src/b.tsx": "export const b = <div />;",
      },
    });
    const [a, b] = await Promise.all([
      loader.load("src/a.ts"),
      loader.load("src/b.tsx"),
    ]);
    expect(a.constants[0]?.name).toBe("a");
    expect(b.constants[0]?.name).toBe("b");
    expect(update).toHaveBeenCalledTimes(1);
  });

  it("reads and parses a repeated path once", async () => {
    const { loader, readFile, update } = setup({
      contents: { "src/a.ts": "export const a = 1;" },
    });
    const first = loader.load("src/a.ts");
    expect(loader.load("src/a.ts")).toBe(first);
    await first;
    expect(await loader.load("src/a.ts")).toBe(await first);
    expect(readFile).toHaveBeenCalledTimes(1);
    expect(update).toHaveBeenCalledTimes(1);
  });

  it("waits for tracked work before flushing so later loads join the batch", async () => {
    const { loader, update } = setup({
      contents: {
        "src/a.ts": "export const a = 1;",
        "src/b.ts": "export const b = 2;",
      },
    });
    const work = loader.track(
      new Promise<void>((resolve) => {
        setTimeout(resolve, 20);
      })
    );
    const a = loader.load("src/a.ts");
    await work;
    const b = loader.load("src/b.ts");
    await Promise.all([a, b]);
    expect(update).toHaveBeenCalledTimes(1);
  });

  it("keeps flushing after tracked work rejects", async () => {
    const { loader } = setup({
      contents: { "src/a.ts": "export const a = 1;" },
    });
    const failure = new Error("Glob failed");
    const work = loader.track(Promise.reject(failure));
    const a = loader.load("src/a.ts");
    await expect(work).rejects.toBe(failure);
    expect((await a).constants[0]?.name).toBe("a");
  });

  it("rejects only the path whose read fails", async () => {
    const { loader, update } = setup({
      contents: { "src/a.ts": "export const a = 1;" },
    });
    const a = loader.load("src/a.ts");
    const missing = loader.load("src/missing.ts");
    await expect(missing).rejects.toThrow("Cannot read src/missing.ts");
    expect((await a).constants[0]?.name).toBe("a");
    expect(update).toHaveBeenCalledTimes(1);
  });

  it("rejects every load in a batch when the native runtime fails", async () => {
    const { loader, update } = setup({
      contents: {
        "src/a.ts": "export const a = 1;",
        "src/b.ts": "export const b = 2;",
      },
    });
    update.mockImplementation(() => {
      throw new Error("Native executable is unavailable");
    });
    const results = await Promise.allSettled([
      loader.load("src/a.ts"),
      loader.load("src/b.ts"),
    ]);
    for (const result of results) {
      expect(result.status).toBe("rejected");
      expect((result as PromiseRejectedResult).reason).toBeInstanceOf(
        TypeScriptRuntimeError
      );
    }
    expect((results[0] as PromiseRejectedResult).reason.message).toContain(
      'while parsing "src/a.ts" and 1 other file'
    );
  });

  it("rejects queued loads on dispose without reading files", async () => {
    const { loader, readFile, update } = setup({
      contents: { "src/a.ts": "export const a = 1;" },
    });
    const a = loader.load("src/a.ts");
    loader.dispose();
    await expect(a).rejects.toThrow("File structure loader was disposed");
    await expect(loader.load("src/b.ts")).rejects.toThrow(
      "File structure loader was disposed"
    );
    await new Promise((resolve) => {
      setImmediate(resolve);
    });
    expect(readFile).not.toHaveBeenCalled();
    expect(update).not.toHaveBeenCalled();
  });
});
