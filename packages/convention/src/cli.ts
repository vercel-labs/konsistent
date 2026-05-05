/// <reference types="node" />
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { defineCommand, runMain } from "citty";
import { createJiti } from "jiti";
import type { ReusableConventionV1 } from "./schemas.js";
import { ReusableConventionsPackageV1Schema } from "./schemas.js";

const emit = defineCommand({
  meta: {
    name: "emit",
    description:
      "Compile a TypeScript module exporting a `conventions` array into a validated reusable-convention-package JSON artifact.",
  },
  args: {
    input: {
      type: "string",
      description:
        "Path to the source module exporting `conventions` (default or named export).",
      default: "src/index.ts",
    },
    output: {
      type: "string",
      description: "Path where the JSON artifact will be written.",
      default: "dist/conventions.json",
    },
    cwd: {
      type: "string",
      description:
        "Working directory paths are resolved against (default: process.cwd()).",
    },
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

const main = defineCommand({
  meta: {
    name: "konsistent-convention",
    description:
      "Authoring CLI for reusable-convention packages consumed by konsistent.",
  },
  subCommands: { emit },
});

runMain(main);
