import { defineConfig } from "tsup";

export default defineConfig([
  {
    entry: ["src/index.ts"],
    format: ["esm"],
    outDir: "dist",
    clean: true,
    splitting: false,
    dts: true,
  },
  {
    entry: ["src/cli.ts"],
    format: ["esm"],
    outDir: "dist",
    clean: false,
    splitting: false,
    dts: false,
    banner: { js: "#!/usr/bin/env node" },
  },
]);
