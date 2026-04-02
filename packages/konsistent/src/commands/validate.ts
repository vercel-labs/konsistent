import { defineCommand } from 'citty';
import pc from 'picocolors';
import { loadConfig } from '../config/index.js';

export default defineCommand({
  meta: {
    name: 'validate',
    description: 'Validate configuration',
  },
  async run() {
    const result = await loadConfig({});
    if ('error' in result) {
      console.error(pc.red(result.error));
      process.exit(1);
    }
    console.log(pc.green('Configuration is valid.'));
  },
});
