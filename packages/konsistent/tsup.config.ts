import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/cli.ts"],
  format: ["esm"],
  outDir: "dist",
  clean: true,
  splitting: false,
  external: ["@konsistent/convention"],
  banner: {
    js: "#!/usr/bin/env node",
  },
});
