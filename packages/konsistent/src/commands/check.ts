import { defineCommand } from 'citty';
import pc from 'picocolors';
import { loadConfig } from '../config/index.js';
import {
  createDefaultReporter,
  createJsonReporter,
  createRealFileSystem,
  run,
} from '../core/index.js';

const checkArgs = {
  format: {
    type: 'string' as const,
    description: 'Output format (default, json)',
    default: 'default',
  },
};

export default defineCommand({
  meta: {
    name: 'check',
    description: 'Check structural conventions',
  },
  args: checkArgs,
  async run({ args }) {
    const result = await loadConfig({});
    if ('error' in result) {
      console.error(pc.red(result.error));
      process.exit(1);
    }

    const fileSystem = createRealFileSystem({ cwd: process.cwd() });
    const diagnostics = await run({
      config: result.config,
      fileSystem,
    });

    if (diagnostics.length > 0) {
      const reporter =
        args.format === 'json' ? createJsonReporter() : createDefaultReporter();
      console.log(reporter.format(diagnostics));
      process.exit(1);
    }
  },
});
