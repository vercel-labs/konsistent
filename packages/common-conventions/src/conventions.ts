import { defineConventions } from "@konsistent/convention";

export const conventions = defineConventions([
  {
    description:
      "Every package directory under packages/ must contain a README.md file.",
    must: {
      haveFiles: ["README.md"],
    },
    name: "package-dir-must-have-readme-file",
    paths: ["packages/*"],
  },
  {
    description:
      "Each component file must export a function whose name matches the file's component name. Reference this convention via { use, paths: [...] } and supply paths declaring the {componentName} placeholder.",
    must: {
      exportFunctions: [{ name: "${componentName}" }],
    },
    name: "file-must-export-equivalent-component-function",
  },
  {
    description:
      "Every TypeScript file in src/ (whose basename has no extra dots) must have a sibling test file ({name}.test.ts). Reference this convention bare to use the default excludeFiles, or supply { use, excludeFiles: [...] } to fully replace the exclude list.",
    excludeFiles: ["legacy.ts"],
    must: {
      haveFiles: ["${name}.test.ts"],
    },
    name: "every-ts-file-must-have-tests",
    paths: ["src/{name:matches(^[^.]+$)}.ts"],
  },
] as const);
