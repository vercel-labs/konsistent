import { defineConfig } from "tsdown";

export default defineConfig([
  {
    entry: ["src/index.ts"],
    format: ["esm"],
    fixedExtension: false,
    outDir: "dist",
    target: "es2022",
    clean: true,
    sourcemap: false,
    outputOptions: {
      codeSplitting: false,
    },
    dts: {
      sourcemap: false,
    },
  },
  {
    entry: ["src/cli.ts"],
    format: ["esm"],
    fixedExtension: false,
    outDir: "dist",
    target: "es2022",
    clean: false,
    sourcemap: false,
    outputOptions: {
      codeSplitting: false,
    },
    dts: false,
    banner: { js: "#!/usr/bin/env node" },
  },
]);
