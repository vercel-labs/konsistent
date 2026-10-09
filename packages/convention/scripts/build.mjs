import { rm } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";

const packageDirectory = resolve(import.meta.dirname, "..");

export async function buildPackage({
  outdir = resolve(packageDirectory, "dist"),
} = {}) {
  await rm(outdir, { recursive: true, force: true });
  const options = {
    absWorkingDir: packageDirectory,
    outdir,
    bundle: true,
    format: "esm",
    platform: "node",
    target: "node22.11",
    splitting: false,
    packages: "external",
  };
  await build({ ...options, entryPoints: ["src/index.ts"] });
  return build({
    ...options,
    entryPoints: ["src/cli.ts"],
    banner: { js: "#!/usr/bin/env node" },
  });
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  await buildPackage();
}
