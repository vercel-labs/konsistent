import { mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { buildPackage } from "./build.mjs";

const shebangPattern = /#!\/usr\/bin\/env node/g;
const conventionImportPattern = /from ["']@konsistent\/convention["']/;
const typescriptImportPattern = /from ["']typescript(?:\/[^"']+)?["']/;

describe("CLI build", () => {
  it("cleans stale output and preserves the standalone ESM CLI", async () => {
    const outdir = await mkdtemp(join(tmpdir(), "konsistent-build-"));
    try {
      await writeFile(join(outdir, "stale.js"), "stale");
      await buildPackage({ outdir });
      expect(await readdir(outdir)).toEqual(["cli.js"]);
      const cli = await readFile(join(outdir, "cli.js"), "utf8");
      expect(cli.startsWith("#!/usr/bin/env node\n")).toBe(true);
      expect(cli.match(shebangPattern)).toHaveLength(1);
      expect(cli).toMatch(conventionImportPattern);
      expect(cli).toMatch(typescriptImportPattern);
      expect(cli.includes("__commonJS")).toBe(false);
    } finally {
      await rm(outdir, { recursive: true, force: true });
    }
  });
});
