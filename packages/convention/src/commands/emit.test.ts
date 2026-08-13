import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runCommand } from "citty";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import emitCommand from "./emit.js";

describe("emit command", () => {
  let temporaryDirectory: string;

  beforeEach(async () => {
    temporaryDirectory = await mkdtemp(
      join(tmpdir(), "konsistent-convention-emit-")
    );
  });

  afterEach(async () => {
    await rm(temporaryDirectory, { recursive: true, force: true });
    vi.restoreAllMocks();
  });

  it("defines its metadata and arguments", () => {
    expect(emitCommand).toMatchObject({
      meta: { name: "emit" },
      args: {
        input: { default: "src/index.ts", type: "string" },
        output: { default: "dist/conventions.json", type: "string" },
        cwd: { type: "string" },
      },
    });
  });

  it("emits a validated package from a TypeScript module", async () => {
    await writeFile(
      join(temporaryDirectory, "conventions.ts"),
      `export const conventions = [
  {
    name: "package-readme",
    description: "Packages must include a README.",
    must: { haveFiles: ["README.md"] },
  },
];
`
    );
    const logSpy = vi.spyOn(console, "log").mockImplementation(vi.fn());

    await runCommand(emitCommand, {
      rawArgs: [
        "--cwd",
        temporaryDirectory,
        "--input",
        "conventions.ts",
        "--output",
        "artifacts/conventions.json",
      ],
    });

    const outputPath = join(temporaryDirectory, "artifacts/conventions.json");
    await expect(readFile(outputPath, "utf8")).resolves.toBe(
      `${JSON.stringify(
        {
          conventionSpecVersion: "v1",
          conventions: [
            {
              name: "package-readme",
              description: "Packages must include a README.",
              must: { haveFiles: ["README.md"] },
            },
          ],
        },
        null,
        2
      )}\n`
    );
    expect(logSpy).toHaveBeenCalledWith(`Generated: ${outputPath}`);
  });
});
