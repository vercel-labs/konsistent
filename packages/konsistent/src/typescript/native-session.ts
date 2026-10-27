import { resolve } from "node:path";
import type { Node, SourceFile } from "typescript/unstable/ast";
import { createVirtualFileSystem } from "typescript/unstable/fs";
import type { UpdateSnapshotParams } from "typescript/unstable/proto";
import { API, type Diagnostic, type Snapshot } from "typescript/unstable/sync";
import { normalizeSource } from "./source-normalization.js";
import type { SourcePosition } from "./types.js";

export interface ParsedSource {
  getPosition: (opts: { node: Node }) => SourcePosition;
  getSyntacticDiagnostics: () => readonly Diagnostic[];
  getText: (opts: { node: Node }) => string;
  printNode: (opts: { node: Node }) => string;
  sourceFile: SourceFile;
}

export interface SourceInput {
  filePath?: string;
  source: string;
}

export interface TypeScriptSession {
  close: () => void;
  withSourceFile: <T>(opts: {
    source: string;
    filePath?: string;
    visit: (source: ParsedSource) => T;
  }) => T;
  withSourceFiles: <T>(opts: {
    sources: readonly SourceInput[];
    visit: (sources: readonly ParsedSource[]) => T;
  }) => T;
}

function describeFilePaths(filePaths: readonly string[] | undefined): string {
  if (!filePaths || filePaths.length === 0) {
    return "";
  }
  if (filePaths.length === 1) {
    return ` while parsing "${filePaths[0]}"`;
  }
  const others = filePaths.length - 1;
  return ` while parsing "${filePaths[0]}" and ${others} other ${others === 1 ? "file" : "files"}`;
}

export class TypeScriptRuntimeError extends Error {
  constructor(opts: { cause: unknown; filePaths?: readonly string[] }) {
    const detail =
      opts.cause instanceof Error ? opts.cause.message : String(opts.cause);
    super(
      `TypeScript 7 native runtime failed${describeFilePaths(opts.filePaths)}: ${detail}. Ensure optional dependencies are installed for ${process.platform}-${process.arch}.`,
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

const compilerOptions = {
  allowJs: true,
  jsx: "preserve",
  module: "esnext",
  noLib: true,
  noResolve: true,
  target: "esnext",
  types: [],
};

function getExtension(filePath: string | undefined): string {
  return (
    extensions.find((candidate) => filePath?.endsWith(`.${candidate}`)) ?? "ts"
  );
}

export function createTypeScriptSession(): TypeScriptSession {
  const cwd = process.cwd();
  const root = resolve(cwd, "__konsistent_typescript__").replaceAll("\\", "/");
  const virtualFs = createVirtualFileSystem({});
  let api: API | undefined;
  let batchId = 0;
  let previousBatch: { configPath: string; paths: string[] } | undefined;
  let closed = false;

  function nativeCall<T>(opts: {
    filePaths?: readonly string[];
    run: () => T;
  }): T {
    try {
      return opts.run();
    } catch (cause) {
      // biome-ignore lint/style/useErrorCause: TypeScriptRuntimeError forwards the caught error as Error.cause.
      throw new TypeScriptRuntimeError({ cause, filePaths: opts.filePaths });
    }
  }

  function withSourceFiles<T>(opts: {
    sources: readonly SourceInput[];
    visit: (sources: readonly ParsedSource[]) => T;
  }): T {
    const { sources, visit } = opts;
    const filePaths = sources.flatMap((input) =>
      input.filePath === undefined ? [] : [input.filePath]
    );
    if (closed) {
      throw new TypeScriptRuntimeError({
        cause: new Error("Session is closed"),
        filePaths,
      });
    }
    if (sources.length === 0) {
      return visit([]);
    }
    batchId += 1;
    const batchRoot = `${root}/batch-${batchId}`;
    const configPath = `${batchRoot}/tsconfig.json`;
    const inputs = sources.map((input, index) => {
      const name = `source-${index}.${getExtension(input.filePath)}`;
      return {
        ...input,
        name,
        normalized: normalizeSource({ source: input.source }),
        virtualPath: `${batchRoot}/${name}`,
      };
    });
    let snapshot: Snapshot | undefined;
    try {
      const parsed = nativeCall({
        filePaths,
        run: () => {
          api ??= new API({
            cwd,
            fs: {
              ...virtualFs,
              getAccessibleEntries: (path) =>
                virtualFs.getAccessibleEntries?.(path) ?? {
                  directories: [],
                  files: [],
                },
              readFile: (path) => virtualFs.readFile?.(path) ?? null,
            },
          });
          for (const input of inputs) {
            virtualFs.writeFile?.(input.virtualPath, input.normalized.text);
          }
          virtualFs.writeFile?.(
            configPath,
            JSON.stringify({
              compilerOptions,
              files: inputs.map((input) => input.name),
            })
          );
          const updateParams: UpdateSnapshotParams = {
            openProjects: [configPath],
          };
          if (previousBatch) {
            updateParams.closeProjects = [previousBatch.configPath];
          }
          snapshot = api.updateSnapshot(updateParams);
          if (previousBatch) {
            for (const path of previousBatch.paths) {
              virtualFs.removeFile?.(path);
            }
          }
          previousBatch = {
            configPath,
            paths: [configPath, ...inputs.map((input) => input.virtualPath)],
          };
          const project = snapshot.getProject(configPath);
          if (!project) {
            throw new Error("Native parser did not return the virtual project");
          }
          const sourceFiles = inputs.map((input) => {
            const sourceFile = project.program.getSourceFile(input.virtualPath);
            if (!sourceFile) {
              throw new Error(
                "Native parser did not return the virtual source file"
              );
            }
            return sourceFile;
          });
          return { project, sourceFiles };
        },
      });
      const { project, sourceFiles } = parsed;
      return visit(
        inputs.map((input, index): ParsedSource => {
          const sourceFile = sourceFiles[index];
          const { normalized, source, virtualPath } = input;
          const inputFilePaths =
            input.filePath === undefined ? undefined : [input.filePath];
          return {
            getPosition({ node }) {
              return normalized.getPosition({
                offset: node.getStart(sourceFile),
              });
            },
            getSyntacticDiagnostics: () =>
              nativeCall({
                filePaths: inputFilePaths,
                run: () => project.program.getSyntacticDiagnostics(virtualPath),
              }),
            getText({ node }) {
              return source.slice(
                normalized.getOriginalOffset({
                  offset: node.getStart(sourceFile),
                }),
                normalized.getOriginalOffset({ offset: node.end })
              );
            },
            printNode: ({ node }) =>
              nativeCall({
                filePaths: inputFilePaths,
                run: () =>
                  project.emitter.printNode(node, {
                    preserveSourceNewlines: false,
                  }),
              }),
            sourceFile,
          };
        })
      );
    } finally {
      if (snapshot) {
        /*
         * The client retains its latest source-file cache even after that
         * snapshot is disposed, until the next snapshot update releases it.
         * Clearing it releases the ASTs of this batch right away instead of
         * holding them for the rest of the session.
         */
        nativeCall({
          filePaths,
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
  }

  return {
    close() {
      if (closed) {
        return;
      }
      closed = true;
      nativeCall({ run: () => api?.close() });
      api = undefined;
    },
    withSourceFile({ source, filePath, visit }) {
      return withSourceFiles({
        sources: [{ filePath, source }],
        visit: ([parsedSource]) => visit(parsedSource),
      });
    },
    withSourceFiles,
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
