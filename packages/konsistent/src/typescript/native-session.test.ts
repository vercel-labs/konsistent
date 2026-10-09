import type { FileChangeSummary } from "typescript/unstable/proto";
import { API, Program, Snapshot } from "typescript/unstable/sync";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createTypeScriptSession,
  TypeScriptRuntimeError,
  withTypeScriptSession,
} from "./native-session.js";
import { parseFileStructure } from "./parser.js";

afterEach(() => vi.restoreAllMocks());

describe("native TypeScript session", () => {
  it("starts lazily and closes idempotently", () => {
    const update = vi.spyOn(API.prototype, "updateSnapshot");
    const close = vi.spyOn(API.prototype, "close");
    const session = createTypeScriptSession();
    expect(update).not.toHaveBeenCalled();
    session.close();
    session.close();
    expect(close).not.toHaveBeenCalled();
    expect(() => parseFileStructure({ source: "", session })).toThrow(
      TypeScriptRuntimeError
    );
  });

  it("reuses one process with fixed slots and clears disposed snapshot caches", () => {
    const update = vi.spyOn(API.prototype, "updateSnapshot");
    const close = vi.spyOn(API.prototype, "close");
    const dispose = vi.spyOn(Snapshot.prototype, "dispose");
    const clear = vi.spyOn(API.prototype, "clearSourceFileCache");
    const session = createTypeScriptSession();
    try {
      for (let index = 0; index < 30; index++) {
        const source =
          index % 3 === 0 ? "" : `export const value${index}: string = "😀";`;
        const structure = parseFileStructure({
          source,
          filePath: `src/${index}.ts`,
          session,
        });
        expect(structure.constants.map((constant) => constant.name)).toEqual(
          source ? [`value${index}`] : []
        );
      }
      expect(update).toHaveBeenCalledTimes(30);
      expect(dispose).toHaveBeenCalledTimes(30);
      expect(clear).toHaveBeenCalledTimes(30);
      const changedPaths = update.mock.calls.slice(1).flatMap(([params]) => {
        const changes = params?.fileChanges;
        return (changes as FileChangeSummary | undefined)?.changed ?? [];
      });
      expect(new Set(changedPaths).size).toBe(1);
    } finally {
      session.close();
    }
    session.close();
    expect(close).toHaveBeenCalledTimes(1);
  });

  it("keeps concurrent sessions independent", () => {
    const first = createTypeScriptSession();
    const second = createTypeScriptSession();
    try {
      expect(
        parseFileStructure({ source: "export const first = 1", session: first })
          .constants[0].name
      ).toBe("first");
      expect(
        parseFileStructure({
          source: "export const second = 2",
          session: second,
        }).constants[0].name
      ).toBe("second");
      first.close();
      expect(
        parseFileStructure({
          source: "export const third = 3",
          session: second,
        }).constants[0].name
      ).toBe("third");
    } finally {
      first.close();
      second.close();
    }
  });

  it("disposes snapshots when a visitor throws without disguising the exception", () => {
    const dispose = vi.spyOn(Snapshot.prototype, "dispose");
    const error = new Error("Visitor failed");
    expect(() =>
      withTypeScriptSession({
        run: (session) =>
          session.withSourceFile({
            source: "export const value = 1;",
            visit() {
              throw error;
            },
          }),
      })
    ).toThrow(error);
    expect(dispose).toHaveBeenCalledTimes(1);
  });

  it("closes owned sessions after runtime failures but leaves borrowed sessions open", () => {
    const failure = new Error("Native executable is unavailable");
    const close = vi.spyOn(API.prototype, "close");
    vi.spyOn(API.prototype, "updateSnapshot").mockImplementation(() => {
      throw failure;
    });
    expect(() =>
      parseFileStructure({ source: "", filePath: "source.ts" })
    ).toThrow('while parsing "source.ts"');
    expect(close).toHaveBeenCalledTimes(1);
    const session = createTypeScriptSession();
    try {
      expect(() => parseFileStructure({ source: "", session })).toThrow(
        "Ensure optional dependencies are installed"
      );
      expect(close).toHaveBeenCalledTimes(1);
    } finally {
      session.close();
    }
    expect(close).toHaveBeenCalledTimes(2);
  });

  it("extracts original text and positions across supported source extensions", () => {
    withTypeScriptSession({
      run(session) {
        for (const extension of [
          "ts",
          "tsx",
          "js",
          "jsx",
          "mts",
          "cts",
          "mjs",
          "cjs",
          "d.ts",
          "d.mts",
          "d.cts",
        ]) {
          const structure = parseFileStructure({
            source: '\ufeff/* 😀 */\r\nexport const café: "\ud800" = "\ud800";',
            filePath: `src/value.${extension}`,
            session,
          });
          expect(structure.constants[0]).toMatchObject({
            name: "café",
            typeName: { text: '"\ud800"' },
            pos: { line: 2, column: 1 },
          });
        }
      },
    });
  });

  it("reports syntax diagnostics without requesting semantic diagnostics", () => {
    const semantic = vi.spyOn(Program.prototype, "getSemanticDiagnostics");
    withTypeScriptSession({
      run: (session) =>
        session.withSourceFile({
          source:
            'import { Missing } from "does-not-exist"; export const value: = ;',
          visit(source) {
            expect(source.getSyntacticDiagnostics().length).toBeGreaterThan(0);
            expect(
              source.getText({ node: source.sourceFile.statements[0] })
            ).toContain("does-not-exist");
          },
        }),
    });
    expect(semantic).not.toHaveBeenCalled();
  });
});
