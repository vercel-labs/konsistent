import { resolve } from "node:path";
import type { Node, SourceFile } from "typescript/unstable/ast";
import { createVirtualFileSystem } from "typescript/unstable/fs";
import { API, type Diagnostic, type Snapshot } from "typescript/unstable/sync";
import { normalizeSource } from "./source-normalization.js";
import type { SourcePosition } from "./types.js";

export interface ParsedSource {
  getPosition(opts: { node: Node }): SourcePosition;
  getSyntacticDiagnostics(): readonly Diagnostic[];
  getText(opts: { node: Node }): string;
  printNode(opts: { node: Node }): string;
  sourceFile: SourceFile;
}

export interface TypeScriptSession {
  close(): void;
  withSourceFile<T>(opts: {
    source: string;
    filePath?: string;
    visit: (source: ParsedSource) => T;
  }): T;
}

export class TypeScriptRuntimeError extends Error {
  constructor(opts: { cause: unknown; filePath?: string }) {
    const detail =
      opts.cause instanceof Error ? opts.cause.message : String(opts.cause);
    super(
      `TypeScript 7 native runtime failed${opts.filePath ? ` while parsing "${opts.filePath}"` : ""}: ${detail}. Ensure optional dependencies are installed for ${process.platform}-${process.arch}.`,
      { cause: opts.cause }
    );
    this.name = "TypeScriptRuntimeError";
  }
}

const extensions = [
  "d.mts",
  "d.cts",
  "d.ts",
  "tsx",
  "jsx",
  "mts",
  "cts",
  "mjs",
  "cjs",
  "js",
  "ts",
];

export function createTypeScriptSession(): TypeScriptSession {
  const cwd = process.cwd();
  const root = resolve(cwd, "__konsistent_typescript__").replaceAll("\\", "/");
  const configPath = `${root}/tsconfig.json`;
  const files: Record<string, string> = Object.create(null);
  const slots = extensions.map(
    (extension) => `source-${extension.replaceAll(".", "-")}.${extension}`
  );
  for (const slot of slots) {
    files[`${root}/${slot}`] = "";
  }
  files[configPath] = JSON.stringify({
    compilerOptions: {
      noLib: true,
      noResolve: true,
      types: [],
      target: "esnext",
      module: "esnext",
      allowJs: true,
      jsx: "preserve",
    },
    files: slots,
  });
  const virtualFs = createVirtualFileSystem(files);
  let api: API | undefined;
  let opened = false;
  let closed = false;

  function nativeCall<T>(opts: { filePath?: string; run: () => T }): T {
    try {
      return opts.run();
    } catch (cause) {
      throw new TypeScriptRuntimeError({ cause, filePath: opts.filePath });
    }
  }

  return {
    withSourceFile({ source, filePath, visit }) {
      if (closed) {
        throw new TypeScriptRuntimeError({
          cause: new Error("Session is closed"),
          filePath,
        });
      }
      const normalized = normalizeSource({ source });
      const extension =
        extensions.find((candidate) => filePath?.endsWith(`.${candidate}`)) ??
        "ts";
      const virtualPath = `${root}/${slots[extensions.indexOf(extension)]}`;
      let snapshot: Snapshot | undefined;
      try {
        const parsed = nativeCall({
          filePath,
          run: () => {
            api ??= new API({
              cwd,
              fs: {
                ...virtualFs,
                readFile: (path) => virtualFs.readFile?.(path) ?? null,
                getAccessibleEntries: (path) =>
                  virtualFs.getAccessibleEntries?.(path) ?? {
                    files: [],
                    directories: [],
                  },
              },
            });
            virtualFs.writeFile?.(virtualPath, normalized.text);
            snapshot = api.updateSnapshot(
              opened
                ? { fileChanges: { changed: [virtualPath] } }
                : { openProjects: [configPath] }
            );
            opened = true;
            const project = snapshot.getProject(configPath);
            const sourceFile = project?.program.getSourceFile(virtualPath);
            if (!(project && sourceFile)) {
              throw new Error(
                "Native parser did not return the virtual source file"
              );
            }
            return { project, sourceFile };
          },
        });
        const { project, sourceFile } = parsed;
        return visit({
          sourceFile,
          getText({ node }) {
            return source.slice(
              normalized.getOriginalOffset({
                offset: node.getStart(sourceFile),
              }),
              normalized.getOriginalOffset({ offset: node.end })
            );
          },
          getPosition({ node }) {
            return normalized.getPosition({
              offset: node.getStart(sourceFile),
            });
          },
          getSyntacticDiagnostics: () =>
            nativeCall({
              filePath,
              run: () => project.program.getSyntacticDiagnostics(virtualPath),
            }),
          printNode: ({ node }) =>
            nativeCall({
              filePath,
              run: () =>
                project.emitter.printNode(node, {
                  preserveSourceNewlines: false,
                }),
            }),
        });
      } finally {
        if (snapshot) {
          /*
           * The client retains its latest source-file cache even after that
           * snapshot is disposed. Clearing it prevents stale ASTs from being
           * carried into the next update of a reusable virtual source slot.
           */
          nativeCall({
            filePath,
            run: () => {
              try {
                snapshot?.dispose();
              } finally {
                api?.clearSourceFileCache();
              }
            },
          });
        }
      }
    },
    close() {
      if (closed) {
        return;
      }
      closed = true;
      nativeCall({ run: () => api?.close() });
      api = undefined;
    },
  };
}

export function withTypeScriptSession<T>(opts: {
  session?: TypeScriptSession;
  run: (session: TypeScriptSession) => T;
}): T {
  if (opts.session) {
    return opts.run(opts.session);
  }
  const session = createTypeScriptSession();
  try {
    return opts.run(session);
  } finally {
    session.close();
  }
}
