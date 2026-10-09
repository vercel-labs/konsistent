import { defineConfig } from "tsdown";

export default defineConfig({
  entry: ["src/cli.ts"],
  format: ["esm"],
  fixedExtension: false,
  outDir: "dist",
  target: "es2022",
  clean: true,
  sourcemap: false,
  dts: false,
  deps: {
    neverBundle: ["@konsistent/convention"],
  },
  outputOptions: {
    codeSplitting: false,
  },
  banner: {
    js: "#!/usr/bin/env node",
  },
});
