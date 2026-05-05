import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { ReusableConventionsPackageV1Schema } from "@konsistent/convention";
import { conventions } from "../src/index.js";

const pkg = ReusableConventionsPackageV1Schema.parse({
  conventionSpecVersion: "v1",
  conventions,
});

const outputPath = resolve(import.meta.dirname, "../dist/conventions.json");
await mkdir(dirname(outputPath), { recursive: true });
await writeFile(outputPath, `${JSON.stringify(pkg, null, 2)}\n`);
console.log(`Generated: ${outputPath}`);
