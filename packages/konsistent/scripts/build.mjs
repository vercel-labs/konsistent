import { rm } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";

const packageDirectory = resolve(import.meta.dirname, "..");

export async function buildPackage({
  outdir = resolve(packageDirectory, "dist"),
} = {}) {
  await rm(outdir, { recursive: true, force: true });
  return build({
    absWorkingDir: packageDirectory,
    entryPoints: ["src/cli.ts"],
    outdir,
    bundle: true,
    format: "esm",
    platform: "node",
    target: "node22.11",
    splitting: false,
    packages: "external",
    banner: { js: "#!/usr/bin/env node" },
  });
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  await buildPackage();
}
