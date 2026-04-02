import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { zodToJsonSchema } from 'zod-to-json-schema';
import { ConfigV1Schema } from '../src/config/schema.js';

const jsonSchema = zodToJsonSchema(ConfigV1Schema, {
  $refStrategy: 'none',
});

jsonSchema.$schema = 'http://json-schema.org/draft-07/schema#';
jsonSchema.$id = 'https://unpkg.com/konsistent/konsistent.schema.json';

const output = JSON.stringify(jsonSchema, null, 2);
const outputPath = resolve(import.meta.dirname, '../konsistent.schema.json');
writeFileSync(outputPath, `${output}\n`);
console.log(`Generated: ${outputPath}`);
