import { defineConventions } from "@konsistent/convention";

export const conventions = defineConventions([
  {
    name: "package-dir-must-have-readme-file",
    description:
      "Every package directory under packages/ must contain a README.md file.",
    paths: ["packages/{packageName}"],
    must: {
      haveFiles: ["README.md"],
    },
  },
  {
    name: "file-must-export-equivalent-component-function",
    description:
      "Each component file must export a function whose name matches the file's component name. Reference this convention via { use, paths: [...] } and supply paths declaring the {componentName} placeholder.",
    must: {
      exportFunctions: [{ name: "${componentName}" }],
    },
  },
  {
    name: "every-ts-file-must-have-tests",
    description:
      "Every TypeScript file in src/ (whose basename has no extra dots) must have a sibling test file ({name}.test.ts). Reference this convention bare to use the default excludeFiles, or supply { use, excludeFiles: [...] } to fully replace the exclude list.",
    paths: ["src/{name:matches(^[^.]+$)}.ts"],
    excludeFiles: ["legacy.ts"],
    must: {
      haveFiles: ["${name}.test.ts"],
    },
  },
] as const);
