import { defineCommand } from 'citty';
import pc from 'picocolors';
import { loadConfig } from '../config/index.js';

const validateArgs = {
  'config-path': {
    type: 'string' as const,
    description: 'Path to konsistent.json config file',
  },
};

export default defineCommand({
  meta: {
    name: 'validate',
    description: 'Validate configuration',
  },
  args: validateArgs,
  async run({ args }) {
    const result = await loadConfig({ configPath: args['config-path'] });
    if ('error' in result) {
      console.error(pc.red(result.error));
      process.exit(1);
    }
    console.log(pc.green('Configuration is valid.'));
  },
});
