import { mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { build } from "tsdown";
import { describe, expect, it } from "vitest";

const packageDirectory = resolve(import.meta.dirname, "..");

const shebangPattern = /#!\/usr\/bin\/env node/g;
const zodImportPattern = /from ["']zod["']/;
const jitiImportPattern = /from ["']jiti["']/;

describe("convention build", () => {
  it("includes shared compiler settings in the test cache inputs", async () => {
    const configuration = JSON.parse(
      await readFile(resolve(packageDirectory, "../../turbo.json"), "utf8")
    );
    expect(configuration.tasks.test.inputs).toEqual(
      expect.arrayContaining(["$TURBO_DEFAULT$", "$TURBO_ROOT$/tsconfig.json"])
    );
  });

  it("preserves independent ESM library and CLI entrypoints", async () => {
    const outdir = await mkdtemp(join(tmpdir(), "convention-build-"));
    try {
      await writeFile(join(outdir, "stale.js"), "stale");
      await build({
        cwd: packageDirectory,
        config: join(packageDirectory, "tsdown.config.ts"),
        outDir: outdir,
        logLevel: "silent",
      });
      expect((await readdir(outdir)).sort()).toEqual([
        "cli.js",
        "index.d.ts",
        "index.js",
      ]);
      const cli = await readFile(join(outdir, "cli.js"), "utf8");
      const library = await readFile(join(outdir, "index.js"), "utf8");
      expect(cli.startsWith("#!/usr/bin/env node\n")).toBe(true);
      expect(cli.match(shebangPattern)).toHaveLength(1);
      expect(library).not.toContain("#!/usr/bin/env node");
      expect(library).toMatch(zodImportPattern);
      expect(library).toContain("defineConventions");
      expect(cli).toMatch(jitiImportPattern);
    } finally {
      await rm(outdir, { recursive: true, force: true });
    }
  });
});
