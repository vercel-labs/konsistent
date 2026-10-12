import { defineConfig } from "tsdown";

export default defineConfig({
  banner: {
    js: "#!/usr/bin/env node",
  },
  clean: true,
  deps: {
    neverBundle: ["@konsistent/convention"],
  },
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
});
