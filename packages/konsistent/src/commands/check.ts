import { defineCommand } from 'citty';
import pc from 'picocolors';
import { loadConfig } from '../config/index.js';
import type { Reporter } from '../core/index.js';
import {
  createDefaultReporter,
  createGithubReporter,
  createJsonReporter,
  createMarkdownReporter,
  createRealFileSystem,
  run,
} from '../core/index.js';

const checkArgs = {
  format: {
    type: 'string' as const,
    description: 'Output format (default, json, github, markdown)',
    default: 'default',
  },
};

function createReporter(opts: { format: string }): Reporter {
  if (opts.format === 'json') {
    return createJsonReporter();
  }
  if (opts.format === 'github') {
    return createGithubReporter();
  }
  if (opts.format === 'markdown') {
    return createMarkdownReporter();
  }
  return createDefaultReporter();
}

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
      const reporter = createReporter({ format: args.format });
      console.log(reporter.format(diagnostics));
      process.exit(1);
    }
  },
});
