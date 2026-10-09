import { mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { buildPackage } from "./build.mjs";

const shebangPattern = /#!\/usr\/bin\/env node/g;
const zodImportPattern = /from ["']zod["']/;
const jitiImportPattern = /from ["']jiti["']/;

describe("convention build", () => {
  it("preserves independent ESM library and CLI entrypoints", async () => {
    const outdir = await mkdtemp(join(tmpdir(), "convention-build-"));
    try {
      await writeFile(join(outdir, "stale.js"), "stale");
      await buildPackage({ outdir });
      expect((await readdir(outdir)).sort()).toEqual(["cli.js", "index.js"]);
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
