import { spawn } from "node:child_process";
import { sep } from "node:path";
import type { FileSystem } from "./filesystem.js";

type RunGit = (opts: { args: string[]; cwd: string }) => Promise<Buffer>;

export interface GitClient {
  listModifiedPaths(): Promise<string[]>;
  listStagedPaths(): Promise<string[]>;
}

function runGitCommand(opts: { args: string[]; cwd: string }): Promise<Buffer> {
  return new Promise((resolvePromise, rejectPromise) => {
    const child = spawn("git", opts.args, {
      cwd: opts.cwd,
      shell: false,
      stdio: ["ignore", "pipe", "pipe"],
    });
    const stdout: Buffer[] = [];
    const stderr: Buffer[] = [];

    child.stdout.on("data", (chunk: Buffer) => stdout.push(chunk));
    child.stderr.on("data", (chunk: Buffer) => stderr.push(chunk));
    child.once("error", (error) => {
      rejectPromise(new Error(`Unable to run Git: ${error.message}`));
    });
    child.once("close", (code) => {
      if (code !== 0) {
        const details = Buffer.concat(stderr).toString("utf8").trim();
        rejectPromise(
          new Error(
            details.length > 0 ? details : `Git exited with code ${code}`
          )
        );
        return;
      }
      resolvePromise(Buffer.concat(stdout));
    });
  });
}

export function parseNullDelimitedPaths(output: Buffer): string[] {
  const paths: string[] = [];
  let start = 0;
  for (let index = 0; index < output.length; index++) {
    if (output[index] !== 0) {
      continue;
    }
    if (index > start) {
      paths.push(output.subarray(start, index).toString("utf8"));
    }
    start = index + 1;
  }
  if (start < output.length) {
    paths.push(output.subarray(start).toString("utf8"));
  }
  return paths;
}

function normalizeGitPath(path: string): string {
  return sep === "/" ? path : path.split(sep).join("/");
}

export function createGitClient(opts: {
  cwd: string;
  fileSystem: FileSystem;
  runGit?: RunGit;
}): GitClient {
  const runGit = opts.runGit ?? runGitCommand;
  let repositoryCheck: Promise<Buffer> | undefined;

  function ensureRepository(): Promise<Buffer> {
    repositoryCheck ??= runGit({
      args: ["rev-parse", "--is-inside-work-tree"],
      cwd: opts.cwd,
    });
    return repositoryCheck;
  }

  async function listPaths(commands: string[][]): Promise<string[]> {
    await ensureRepository();
    const outputs = await Promise.all(
      commands.map((args) => runGit({ args, cwd: opts.cwd }))
    );
    const paths = new Set(
      outputs
        .flatMap(parseNullDelimitedPaths)
        .map(normalizeGitPath)
        .filter((path) => opts.fileSystem.isFile(path))
    );
    return [...paths].sort();
  }

  const stagedCommand = [
    "diff",
    "--name-only",
    "--relative",
    "-z",
    "--cached",
    "--diff-filter=ACMR",
    "--",
  ];

  return {
    listStagedPaths(): Promise<string[]> {
      return listPaths([stagedCommand]);
    },
    listModifiedPaths(): Promise<string[]> {
      return listPaths([
        stagedCommand,
        ["diff", "--name-only", "--relative", "-z", "--diff-filter=ACMR", "--"],
        ["ls-files", "--others", "--exclude-standard", "-z", "--"],
      ]);
    },
  };
}
