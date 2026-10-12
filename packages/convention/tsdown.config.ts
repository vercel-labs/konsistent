import { defineConfig } from "tsdown";

export default defineConfig([
  {
    clean: true,
    dts: {
      generator: "tsgo",
      sourcemap: false,
    },
    entry: ["src/index.ts"],
    fixedExtension: false,
    format: ["esm"],
    outDir: "dist",
    outputOptions: {
      codeSplitting: false,
    },
    sourcemap: false,
    target: "es2022",
  },
  {
    banner: { js: "#!/usr/bin/env node" },
    clean: false,
    dts: false,
    entry: ["src/cli.ts"],
    fixedExtension: false,
    format: ["esm"],
    outDir: "dist",
    outputOptions: {
      codeSplitting: false,
    },
    sourcemap: false,
    target: "es2022",
  },
]);
