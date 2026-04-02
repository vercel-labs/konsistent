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
import {
  formatTruncationMessage,
  truncateDiagnostics,
} from '../core/truncate-diagnostics.js';

const checkArgs = {
  'config-path': {
    type: 'string' as const,
    description: 'Path to konsistent.json config file',
  },
  format: {
    type: 'string' as const,
    description: 'Output format (default, json, github, markdown)',
    default: 'default',
  },
  verbose: {
    type: 'boolean' as const,
    description: 'Show execution time and expanded details',
    default: false,
  },
  'max-diagnostics': {
    type: 'string' as const,
    description: 'Maximum number of diagnostics to report',
    default: '20',
  },
  colors: {
    type: 'boolean' as const,
    description: 'Enable or disable colored output',
  },
};

function createReporter(opts: { format: string; colors?: boolean }): Reporter {
  if (opts.format === 'json') {
    return createJsonReporter();
  }
  if (opts.format === 'github') {
    return createGithubReporter();
  }
  if (opts.format === 'markdown') {
    return createMarkdownReporter();
  }
  return createDefaultReporter({ colors: opts.colors });
}

export default defineCommand({
  meta: {
    name: 'check',
    description: 'Check structural conventions',
  },
  args: checkArgs,
  async run({ args }) {
    const result = await loadConfig({ configPath: args['config-path'] });
    if ('error' in result) {
      console.error(pc.red(result.error));
      process.exit(1);
    }

    const fileSystem = createRealFileSystem({ cwd: process.cwd() });
    const runResult = await run({
      config: result.config,
      fileSystem,
    });

    const maxDiags = Number.parseInt(args['max-diagnostics'], 10) || 20;
    const { diagnostics: reported, omitted } = truncateDiagnostics({
      diagnostics: runResult.diagnostics,
      max: maxDiags,
    });

    const reporter = createReporter({
      format: args.format,
      colors: args.colors,
    });
    const formatted = reporter.format({ ...runResult, diagnostics: reported });

    const output: string[] = [];
    if (formatted) {
      output.push(formatted);
    }
    if (omitted > 0) {
      output.push(formatTruncationMessage(omitted));
    }
    if (output.length > 0) {
      process.stdout.write(`${output.join('\n')}\n`);
    }

    if (runResult.diagnostics.length > 0) {
      process.exit(1);
    }
  },
});
