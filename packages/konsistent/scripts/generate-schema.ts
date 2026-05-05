import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { z } from "zod";
import { ConfigV1Schema } from "../src/config/schema.js";

const jsonSchema = z.toJSONSchema(ConfigV1Schema, {
  target: "draft-7",
  reused: "inline",
}) as Record<string, unknown>;

jsonSchema.$schema = "http://json-schema.org/draft-07/schema#";
jsonSchema.$id = "https://unpkg.com/konsistent/konsistent.schema.json";

const output = JSON.stringify(jsonSchema, null, 2);
const outputPath = resolve(import.meta.dirname, "../konsistent.schema.json");
writeFileSync(outputPath, `${output}\n`);
console.log(`Generated: ${outputPath}`);
