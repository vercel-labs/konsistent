import type { TypeScriptSession } from "../typescript/native-session.js";
import { parseFileStructures } from "../typescript/parser.js";
import type { FileStructure } from "../typescript/types.js";
import type { FileSystem } from "./filesystem.js";

export interface FileStructureLoader {
  dispose: () => void;
  load: (filePath: string) => Promise<FileStructure>;
  track: <T>(work: Promise<T>) => Promise<T>;
}

interface QueuedLoad {
  reject: (reason: unknown) => void;
  resolve: (structure: FileStructure) => void;
}

/*
 * Every TypeScript 7 snapshot update is a round trip to the native process, so
 * file structures are parsed in batches rather than one at a time. Loads are
 * queued and flushed together once the runner has nothing else to do: the
 * flush runs from `setImmediate`, after all pending microtasks, and only while
 * no tracked work (such as `for.files` glob matching) is still in flight.
 * Any other asynchronous step during evaluation must go through `track`;
 * otherwise a batch may be flushed early, which splits it into more native
 * snapshots without affecting results.
 */
export function createFileStructureLoader(opts: {
  fileSystem: FileSystem;
  session: TypeScriptSession;
}): FileStructureLoader {
  const { fileSystem, session } = opts;
  const structures = new Map<string, Promise<FileStructure>>();
  let queue = new Map<string, QueuedLoad>();
  let pendingWork = 0;
  let flushScheduled = false;
  let disposed = false;

  function flush(): void {
    flushScheduled = false;
    if (disposed || pendingWork > 0 || queue.size === 0) {
      return;
    }
    const batch = queue;
    queue = new Map();
    const inputs: { filePath: string; load: QueuedLoad; source: string }[] = [];
    for (const [filePath, load] of batch) {
      try {
        inputs.push({ filePath, load, source: fileSystem.readFile(filePath) });
      } catch (error) {
        load.reject(error);
      }
    }
    if (inputs.length === 0) {
      return;
    }
    let parsed: FileStructure[];
    try {
      parsed = parseFileStructures({
        session,
        sources: inputs.map(({ filePath, source }) => ({ filePath, source })),
      });
    } catch (error) {
      for (const input of inputs) {
        input.load.reject(error);
      }
      return;
    }
    inputs.forEach((input, index) => {
      input.load.resolve(parsed[index]);
    });
  }

  function scheduleFlush(): void {
    if (flushScheduled || disposed || pendingWork > 0 || queue.size === 0) {
      return;
    }
    flushScheduled = true;
    setImmediate(flush);
  }

  return {
    dispose() {
      if (disposed) {
        return;
      }
      disposed = true;
      const error = new Error("File structure loader was disposed");
      for (const load of queue.values()) {
        load.reject(error);
      }
      queue.clear();
    },
    load(filePath) {
      const existing = structures.get(filePath);
      if (existing) {
        return existing;
      }
      if (disposed) {
        return Promise.reject(new Error("File structure loader was disposed"));
      }
      let load: QueuedLoad | undefined;
      const promise = new Promise<FileStructure>((resolve, reject) => {
        load = { reject, resolve };
      });
      structures.set(filePath, promise);
      queue.set(filePath, load as QueuedLoad);
      scheduleFlush();
      return promise;
    },
    track(work) {
      pendingWork += 1;
      return work.finally(() => {
        pendingWork -= 1;
        scheduleFlush();
      });
    },
  };
}
