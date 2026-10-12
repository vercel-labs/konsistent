import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { defineCommand } from "citty";
import { createJiti } from "jiti";
import type { ReusableConventionV1 } from "../schemas.js";
import { ReusableConventionsPackageV1Schema } from "../schemas.js";

const emitArgs = {
  cwd: {
    description:
      "Working directory paths are resolved against (default: process.cwd()).",
    type: "string" as const,
  },
  input: {
    default: "src/index.ts",
    description:
      "Path to the source module exporting `conventions` (default or named export).",
    type: "string" as const,
  },
  output: {
    default: "dist/conventions.json",
    description: "Path where the JSON artifact will be written.",
    type: "string" as const,
  },
};

export default defineCommand({
  args: emitArgs,
  meta: {
    description:
      "Compile a TypeScript module exporting a `conventions` array into a validated reusable-convention-package JSON artifact.",
    name: "emit",
  },
  async run({ args }) {
    const cwd = resolve(process.cwd(), args.cwd ?? ".");
    const inputPath = resolve(cwd, args.input);
    const outputPath = resolve(cwd, args.output);

    const jiti = createJiti(pathToFileURL(cwd).href, { interopDefault: true });
    const mod = (await jiti.import(inputPath)) as Record<string, unknown>;
    const conventions = (mod.conventions ?? mod.default) as
      | readonly ReusableConventionV1[]
      | undefined;

    if (!Array.isArray(conventions)) {
      console.error(
        `Module "${inputPath}" must export a "conventions" array (or have it as the default export).`
      );
      process.exit(1);
    }

    const result = ReusableConventionsPackageV1Schema.safeParse({
      conventionSpecVersion: "v1",
      conventions,
    });
    if (!result.success) {
      const issues = result.error.issues
        .map((issue) => `  - ${issue.path.join(".")}: ${issue.message}`)
        .join("\n");
      console.error(
        `Invalid reusable-convention package at ${inputPath}:\n${issues}`
      );
      process.exit(1);
    }

    await mkdir(dirname(outputPath), { recursive: true });
    await writeFile(outputPath, `${JSON.stringify(result.data, null, 2)}\n`);
    console.log(`Generated: ${outputPath}`);
  },
});
