const baseConfig = {
  clean: true,
  fixedExtension: false,
  format: ["esm" as const],
  target: "es2022" as const,
  tsconfig: "tsconfig.build.json",
};

export const sdkBaseConfig = {
  ...baseConfig,
  dts: true,
  sourcemap: true,
};

export const cliBaseConfig = {
  ...baseConfig,
  banner: {
    js: "#!/usr/bin/env node",
  },
  dts: false,
  outputOptions: {
    codeSplitting: false,
  },
  sourcemap: false,
};
