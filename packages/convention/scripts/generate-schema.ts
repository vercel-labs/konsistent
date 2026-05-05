import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { z } from "zod";
import { ReusableConventionsPackageV1Schema } from "../src/schemas.js";

const jsonSchema = z.toJSONSchema(ReusableConventionsPackageV1Schema, {
  target: "draft-7",
  reused: "inline",
}) as Record<string, unknown>;

jsonSchema.$schema = "http://json-schema.org/draft-07/schema#";
jsonSchema.$id =
  "https://unpkg.com/@konsistent/convention/reusable-convention-package.schema.json";

const output = JSON.stringify(jsonSchema, null, 2);
const outputPath = resolve(
  import.meta.dirname,
  "../reusable-convention-package.schema.json"
);
writeFileSync(outputPath, `${output}\n`);
console.log(`Generated: ${outputPath}`);
