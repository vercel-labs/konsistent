import { API, Program, Snapshot } from "typescript/unstable/sync";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createTypeScriptSession,
  TypeScriptRuntimeError,
  withTypeScriptSession,
} from "./native-session.js";
import { parseFileStructure, parseFileStructures } from "./parser.js";

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
    expect(() => parseFileStructure({ session, source: "" })).toThrow(
      TypeScriptRuntimeError
    );
  });

  it("reuses one process, opens one project per batch, and closes the previous batch project", () => {
    const update = vi.spyOn(API.prototype, "updateSnapshot");
    const close = vi.spyOn(API.prototype, "close");
    const dispose = vi.spyOn(Snapshot.prototype, "dispose");
    const clear = vi.spyOn(API.prototype, "clearSourceFileCache");
    const session = createTypeScriptSession();
    try {
      for (let index = 0; index < 30; index += 1) {
        const source =
          index % 3 === 0 ? "" : `export const value${index}: string = "😀";`;
        const structure = parseFileStructure({
          filePath: `src/${index}.ts`,
          session,
          source,
        });
        expect(structure.constants.map((constant) => constant.name)).toEqual(
          source ? [`value${index}`] : []
        );
      }
      expect(update).toHaveBeenCalledTimes(30);
      expect(dispose).toHaveBeenCalledTimes(30);
      expect(clear).toHaveBeenCalledTimes(30);
      const params = update.mock.calls.map(([call]) => call);
      expect(params[0]?.closeProjects).toBeUndefined();
      const opened = params.map((call) => call?.openProjects?.[0]);
      expect(new Set(opened).size).toBe(30);
      for (let index = 1; index < params.length; index += 1) {
        expect(params[index]?.closeProjects).toEqual([opened[index - 1]]);
      }
    } finally {
      session.close();
    }
    session.close();
    expect(close).toHaveBeenCalledTimes(1);
  });

  it("parses many sources with one snapshot update and keeps input order", () => {
    const update = vi.spyOn(API.prototype, "updateSnapshot");
    withTypeScriptSession({
      run(session) {
        const structures = parseFileStructures({
          session,
          sources: [
            { filePath: "src/a.ts", source: "export const a = 1;" },
            { filePath: "src/b.tsx", source: "export const b = <div />;" },
            { source: "export const c = 3;" },
            { filePath: "src/a.ts", source: "export const d = 4;" },
          ],
        });
        expect(
          structures.map((structure) => structure.constants[0]?.name)
        ).toEqual(["a", "b", "c", "d"]);
      },
    });
    expect(update).toHaveBeenCalledTimes(1);
  });

  it("returns an empty batch without starting the native process", () => {
    const update = vi.spyOn(API.prototype, "updateSnapshot");
    const session = createTypeScriptSession();
    expect(
      session.withSourceFiles({
        sources: [],
        visit: (sources) => sources.length,
      })
    ).toBe(0);
    expect(update).not.toHaveBeenCalled();
    session.close();
    expect(() =>
      session.withSourceFiles({ sources: [], visit: () => undefined })
    ).toThrow(TypeScriptRuntimeError);
  });

  it("names the first file and counts the others when a batch fails", () => {
    vi.spyOn(API.prototype, "updateSnapshot").mockImplementation(() => {
      throw new Error("Native executable is unavailable");
    });
    expect(() =>
      parseFileStructures({
        sources: [
          { filePath: "src/a.ts", source: "" },
          { filePath: "src/b.ts", source: "" },
          { filePath: "src/c.ts", source: "" },
        ],
      })
    ).toThrow('while parsing "src/a.ts" and 2 other files');
  });

  it("keeps concurrent sessions independent", () => {
    const first = createTypeScriptSession();
    const second = createTypeScriptSession();
    try {
      expect(
        parseFileStructure({ session: first, source: "export const first = 1" })
          .constants[0].name
      ).toBe("first");
      expect(
        parseFileStructure({
          session: second,
          source: "export const second = 2",
        }).constants[0].name
      ).toBe("second");
      first.close();
      expect(
        parseFileStructure({
          session: second,
          source: "export const third = 3",
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
      parseFileStructure({ filePath: "source.ts", source: "" })
    ).toThrow('while parsing "source.ts"');
    expect(close).toHaveBeenCalledTimes(1);
    const session = createTypeScriptSession();
    try {
      expect(() => parseFileStructure({ session, source: "" })).toThrow(
        "Ensure optional dependencies are installed"
      );
      expect(close).toHaveBeenCalledTimes(1);
    } finally {
      session.close();
    }
    expect(close).toHaveBeenCalledTimes(2);
  });

  it.each(["per file", "in one batch"] as const)(
    "extracts original text and positions across supported source extensions %s",
    (mode) => {
      const extensions = [
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
      ];
      const source =
        '\ufeff/* 😀 */\r\nexport const café: "\ud800" = "\ud800";';
      withTypeScriptSession({
        run(session) {
          const structures =
            mode === "per file"
              ? extensions.map((extension) =>
                  parseFileStructure({
                    filePath: `src/value.${extension}`,
                    session,
                    source,
                  })
                )
              : parseFileStructures({
                  session,
                  sources: extensions.map((extension) => ({
                    filePath: `src/value.${extension}`,
                    source,
                  })),
                });
          expect(structures).toHaveLength(extensions.length);
          for (const structure of structures) {
            expect(structure.constants[0]).toMatchObject({
              name: "café",
              pos: { column: 1, line: 2 },
              typeName: { text: '"\ud800"' },
            });
          }
        },
      });
    }
  );

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
